// honestly just putting this here because it takes up so much vertical space on my MacBook
export const renameReceipit = `You are tasked with naming a receipt image according to a specific convention. Your goal is to extract key information from the image and use it to create a standardized filename.

Carefully examine the image and identify the following information:
1. The date of the transaction (in YYYY-MM-DD format)
2. The name of the merchant
3. The type of expense

The expense type must be one of the following:
- TRANSPORTATION
- LODGING
- MEALS-PER-DIEM
- GROUND-TRANSPORTATION

If the merchant name is not clearly visible or identifiable in the image, use a generic description of the merchant type (e.g., "restaurant", "hotel", "taxi-service").

Using the information you've extracted, create a filename in the following format:
YYYY-MM-DD_<expense_type>_<merchant_name>

For example, if the receipt is dated January 15, 2023, from Hilton Hotels, and it's for lodging, the filename would be:
2023-01-15_lodging_hilton-hotels

Provide your answer in the following format:
<filename>Your generated filename here</filename>

If you cannot determine one or more of the required elements from the image, explain what information is missing in your response before providing the best possible filename based on the available information.`;
