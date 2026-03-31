# Workflow Files

Export each workflow from n8n (⋮ menu → Download) and place the JSON files here.

| Filename | Workflow |
|---|---|
| `01_s3_ingestion.json` | Document upload → S3 → Supabase upsert |
| `02_textract_ocr.json` | Textract extraction + normalization |
| `03_expense_extract_v1.json` | AI extraction agent (Expense_Extract_v1_W3) |
| `04_approval_webhook.json` | State machine + audit logging |
| `05_csv_export.json` | Approved expense CSV export → S3 |

## How to Import

1. Open n8n
2. Click **+** → **Import Workflow**
3. Upload the `.json` file
4. Add your credentials (Supabase, AWS, OpenAI)
5. Test with the webhook trigger or manual execution
