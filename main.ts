import {
  BedrockRuntimeClient,
  ConverseCommand,
} from "npm:@aws-sdk/client-bedrock-runtime";
import { renameReceipit } from "./prompts.ts";

export const CONFIG = {
  DIRECTORIES: {
    RAW_RECEIPTS: "./receipts",
    RENAMED_RECEIPTS: "./renamed-receipts",
  },
  IMAGE: {
    SUPPORTED_EXTENSIONS: ["jpg", "jpeg", "png", "gif", "webp"] as const,
    EXTENSION_MAPPING: {
      jpg: "jpeg",
    } as const,
  },
  BEDROCK: {
    MODEL_ID: "us.amazon.nova-pro-v1:0",
    TEMPERATURE: 0,
  },
} as const;

export type BedrockAcceptedImageExtensions = "png" | "jpeg" | "gif" | "webp";
export type ExtensionMappingKeys = keyof typeof CONFIG.IMAGE.EXTENSION_MAPPING;

export interface ImageProcessingResult {
  success: boolean;
  originalName: string;
  newName?: string;
  error?: Error;
}

export interface BedrockResponse {
  output?: {
    message?: {
      content?: Array<{
        text?: string;
      }>;
    };
  };
}

/**
 * Checks if the given extension is a valid image extension based on Bedrock's Converse API's accepted extensions.
 *
 * @param extension - The image file extension to validate.
 * @returns True if the extension is one of the accepted image extensions, otherwise, false.
 */
export const isValidImageExtension = (
  extension: string
): extension is BedrockAcceptedImageExtensions => {
  return CONFIG.IMAGE.SUPPORTED_EXTENSIONS.includes(extension as any);
};

/**
 * Validates that the given path exists and is a directory. If it doesn't
 * exist, it will be created.
 *
 * @param path - The path to validate as a directory.
 * @throws {Error} If the path is not a directory.
 */
export const validateDirectory = async (path: string): Promise<void> => {
  try {
    const stat = await Deno.stat(path);
    if (!stat.isDirectory) {
      throw new Error(`${path} is not a directory`);
    }
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      await Deno.mkdir(path, { recursive: true });
    } else {
      throw error;
    }
  }
};

/**
 * Retrieves the 'normalized' image extension for a given file name.
 *
 * This function extracts the file extension from the provided file name,
 * converts it to lowercase, and maps it to a standard extension if it exists
 * in the extension mapping configuration. If no mapping is found, the original
 * extension is returned.
 *
 * @param fileName - The name of the file to extract and normalize its extension.
 * @returns The normalized image extension, which is one of Bedrock's Converse API's accepted image extensions.
 */
export const getNormalizedExtension = (
  fileName: string
): BedrockAcceptedImageExtensions => {
  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  return (
    extension in CONFIG.IMAGE.EXTENSION_MAPPING
      ? CONFIG.IMAGE.EXTENSION_MAPPING[extension as ExtensionMappingKeys]
      : extension
  ) as BedrockAcceptedImageExtensions;
};

/**
 * Extracts a filename from a given response content.
 *
 * This function takes a string response content from Bedrock's Converse API and
 * extracts a filename from it. The filename is expected (due to our prompt) to be wrapped in a
 * `<filename>` tag. If no filename is found, an error is thrown.
 *
 * @param content - The response content to extract a filename from.
 * @returns The extracted filename.
 * @throws {Error} If no filename is found in the given content.
 */
export const extractFilename = (content: string): string => {
  const regex = /<filename>(.*?)<\/filename>/s;
  const match = content.match(regex);
  if (!match?.[1]) {
    throw new Error("Failed to extract filename from response");
  }
  return match[1];
};

const client = new BedrockRuntimeClient();

/**
 * Sends a request to Bedrock to generate a new filename for a receipt image.
 *
 * This function takes a receipt image and its format, sends a request to Bedrock
 * to generate a filename for the image, and returns the generated filename.
 *
 * It will retry the request up to 3 times if it fails.
 *
 * @param image - The receipt image to generate a filename for.
 * @param imageFormat - The format of the receipt image.
 * @param retries - The number of remaining retries. Defaults to 3.
 * @returns The generated filename for the receipt image.
 */
export const getNewFilename = async (
  image: Uint8Array,
  imageFormat: BedrockAcceptedImageExtensions,
  retries = 3
): Promise<string> => {
  const command = new ConverseCommand({
    modelId: CONFIG.BEDROCK.MODEL_ID,
    inferenceConfig: {
      temperature: CONFIG.BEDROCK.TEMPERATURE,
    },
    system: [{ text: renameReceipit }],
    messages: [
      {
        role: "user",
        content: [
          { text: "Here is the receipt image to analyze:" },
          {
            image: {
              source: { bytes: image },
              format: imageFormat,
            },
          },
        ],
      },
    ],
  });

  try {
    const response = (await client.send(command)) as BedrockResponse;
    if (!response.output?.message?.content?.[0]?.text) {
      throw new Error("Invalid response from Bedrock");
    }
    return extractFilename(response.output.message.content[0].text);
  } catch (error) {
    if (retries > 0) {
      console.warn(`Retry attempt ${4 - retries} for Bedrock API call`);
      return getNewFilename(image, imageFormat, retries - 1);
    }
    throw error;
  }
};

/**
 * Processes a single receipt image in the raw receipts directory.
 *
 * @param dirEntry - The directory entry of the receipt image to process.
 * @returns An {@link ImageProcessingResult} that contains the original name of the file and the new name if the processing was successful.
 */
async function processImage(
  dirEntry: Deno.DirEntry
): Promise<ImageProcessingResult> {
  const result: ImageProcessingResult = {
    success: false,
    originalName: dirEntry.name,
  };

  try {
    const extension = getNormalizedExtension(dirEntry.name);
    if (!isValidImageExtension(extension)) {
      throw new Error(`Unsupported image format: ${extension}`);
    }

    const imagePath = `${CONFIG.DIRECTORIES.RAW_RECEIPTS}/${dirEntry.name}`;
    const image = await Deno.readFile(imagePath);

    const newFileName = await getNewFilename(image, extension);
    const newPath = `${CONFIG.DIRECTORIES.RENAMED_RECEIPTS}/${newFileName}.${extension}`;

    await Deno.writeFile(newPath, image);

    result.success = true;
    result.newName = newFileName;
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error : new Error(String(error));
  }

  return result;
}

/**
 * Main entry point validates the directories used by the script, reads the list of receipt images to process,
 * processes each of them using the `processImage` function, and logs the results.
 *
 * If any errors occur during the execution, the script will catch them, log an error, and exit with a non-zero status code.
 */
async function main(): Promise<void> {
  try {
    await validateDirectory(CONFIG.DIRECTORIES.RAW_RECEIPTS);
    await validateDirectory(CONFIG.DIRECTORIES.RENAMED_RECEIPTS);

    const files: Deno.DirEntry[] = [];
    for await (const entry of Deno.readDir(CONFIG.DIRECTORIES.RAW_RECEIPTS)) {
      if (entry.isFile) {
        files.push(entry);
      }
    }

    console.log(`Processing ${files.length} recipts...`);

    const results = await Promise.all(files.map(processImage));

    const successful = results.filter((r) => r.success).length;
    const failed = results.filter((r) => !r.success).length;

    results.forEach((result) => {
      if (result.success) {
        console.log(
          `Successfully renamed ${result.originalName} to ${result.newName}`
        );
      } else {
        console.error(
          `Failed to process ${result.originalName}: ${result.error?.message}`
        );
      }
    });

    console.log(
      `\nProcessed ${results.length} images: ${successful} successful, ${failed} failed`
    );

    if (failed > results.length / 2) {
      console.error(
        "You really messed up! <ore than half of the images failed to process."
      );
    }
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}

// Okay idk if this is standard in ECMAScript world, but ya know...`if __name__ == "__main__":`
if (import.meta.main) {
  main();
}
