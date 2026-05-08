# Workflow: Import Customer Data from CSV

# Workflow: Import Customer Data from CSV

## Objective
To import a list of customer records from a CSV file into the `clients` table of the PostgreSQL database. This is typically used for initial data migration or bulk updates.

## Inputs Required
- `csv_file_path`: The absolute path to the CSV file containing customer data.

## Tools Used
- `tools/import_customer_csv.py` — Reads a CSV file, parses customer data, and inserts/updates records in the `clients` table.

## Steps
1. Obtain the CSV file containing customer data. Ensure it has columns for `first_name`, `last_name`, `phone`, `email`, and `notes`. The `phone` column is crucial for identifying existing clients.
2. Place the CSV file in a known location (e.g., `.tmp/customers.csv`).
3. **IMPORTANT:** Verify the `DATABASE_URL` in your `.env` file matches the environment you are trying to update (Local vs Render Production).
4. Execute the `import_customer_csv.py` tool, passing the path to the CSV file as an argument.
5. Review the output of the tool for any errors or warnings regarding skipped rows or data inconsistencies.

## Expected Output
- Customer data from the CSV file is successfully added to or updated in the `clients` table in the PostgreSQL database.
- A summary report from the tool indicating the number of new clients added and existing clients updated.

## Edge Cases & Notes
- **Duplicate Phone Numbers:** The tool will attempt to update existing clients if a matching phone number is found. If multiple rows in the CSV have the same phone number, only the last one processed will be reflected for updates.
- **Missing Data:** Rows with missing `first_name` or `phone` will be skipped with a warning.
- **Phone Number Format:** The tool will attempt to clean and format phone numbers to a 10-digit string for matching.
- **Database Connection:** Ensure the `DATABASE_URL` environment variable is correctly set for the tool to connect to PostgreSQL.
- **Large Files:** For very large CSV files, consider running the import in batches or optimizing the tool for memory usage.