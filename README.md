# re-recipts

This script uses Amazon Nova's image analysis capabilities to intelligently rename receipt images based on their contents. I built this for keeping track of all of my recipts for re:invent 2024.

## Usage

### Prerequisites

1. Install [Deno](https://deno.land/)
2. ~~Install all of the node modules~~ jk you're using Deno so you don't have to do that.
3. Make sure you have authenticated your CLI to AWS and that you have access to Amazon's New Nova models (we're using **Nova Pro** for this script)
4. Freshly brewed coffee.

### Instructions

1. Place your receipt images in the receipts directory
2. Run the script:

```shell
deno run -A main.ts
```

The script will:

1. Process all images in the receipts directory
2. Generate appropriate names based on image content
3. Save renamed copies in the renamed-receipts directory
4. Display progress and results in the console

Supported Image Formats

- JPEG (`.jpg`, `.jpeg`)
- PNG (`.png`)
- GIF (`.gif`)
- WebP (`.webp`)
