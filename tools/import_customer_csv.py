import csv
import os
import psycopg2
from urllib.parse import urlparse
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

def import_customer_csv(csv_file_path):
    """
    Imports customer data from a CSV file into the PostgreSQL 'clients' table.
    Updates existing clients based on phone number, or inserts new ones.
    Assumes CSV columns: first_name,last_name,phone,email,notes
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL environment variable not set.")
        return

    try:
        url = urlparse(database_url)
        conn = psycopg2.connect(
            database=url.path[1:],
            user=url.username,
            password=url.password,
            host=url.hostname,
            port=url.port
        )
        cur = conn.cursor()
    except Exception as e:
        print(f"Error connecting to database: {e}")
        return

    new_clients_count = 0
    updated_clients_count = 0
    skipped_rows_count = 0

    try:
        with open(csv_file_path, mode='r', encoding='utf-8') as file:
            reader = csv.DictReader(file)
            for i, row in enumerate(reader):
                first_name = row.get('first_name', '').strip()
                last_name = row.get('last_name', '').strip()
                phone = row.get('phone', '').strip()
                email = row.get('email', '').strip()
                notes = row.get('notes', '').strip()

                # Basic validation
                if not first_name or not phone:
                    print(f"Warning: Skipping row {i+1} due to missing first_name or phone: {row}")
                    skipped_rows_count += 1
                    continue

                # Clean and format phone number to 10 digits
                cleaned_phone = ''.join(filter(str.isdigit, phone))
                if len(cleaned_phone) != 10:
                    print(f"Warning: Skipping row {i+1} due to invalid phone number format (not 10 digits after cleaning): {phone}")
                    skipped_rows_count += 1
                    continue
                formatted_phone = f"({cleaned_phone[0:3]}) {cleaned_phone[3:6]}-{cleaned_phone[6:10]}"

                try:
                    # Check if client already exists by phone number
                    cur.execute(
                        "SELECT id FROM clients WHERE regexp_replace(phone, '\\D', '', 'g') = %s",
                        (cleaned_phone,)
                    )
                    existing_client = cur.fetchone()

                    if existing_client:
                        # Update existing client
                        cur.execute(
                            """
                            UPDATE clients
                            SET first_name = %s, last_name = %s, email = %s, notes = %s
                            WHERE id = %s
                            """,
                            (first_name, last_name, email, notes, existing_client[0])
                        )
                        updated_clients_count += 1
                    else:
                        # Insert new client
                        cur.execute(
                            "INSERT INTO clients (first_name, last_name, phone, email, notes) VALUES (%s, %s, %s, %s, %s)",
                            (first_name, last_name, formatted_phone, email, notes)
                        )
                        new_clients_count += 1
                except Exception as db_err:
                    print(f"Error processing row {i+1} ({row}): {db_err}")
                    skipped_rows_count += 1

        conn.commit()
        print(f"Import complete: {new_clients_count} new clients, {updated_clients_count} updated clients, {skipped_rows_count} rows skipped.")

    except FileNotFoundError:
        print(f"Error: CSV file not found at {csv_file_path}")
    except Exception as e:
        print(f"An unexpected error occurred during CSV processing: {e}")
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python import_customer_csv.py <path_to_csv_file>")
    else:
        import_customer_csv(sys.argv[1])