import { NextResponse } from 'next/server';

/**
 * POST /api/upload
 * Accepts a receipt file (image or PDF) and optional project context,
 * then forwards everything to the n8n upload webhook for OCR processing.
 *
 * Form fields:
 *   file       — required, the receipt file
 *   project_id — optional, associates the receipt with a project
 *   client_id  — optional, associates the receipt with a client
 */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided' },
        { status: 400 }
      );
    }

    // Read project/client context sent by the frontend
    const projectId = formData.get('project_id') as string | null;
    const clientId  = formData.get('client_id')  as string | null;

    // Forward everything to n8n in one multipart body.
    // In n8n, read these as: $json.body.org_id / $json.body.project_id / $json.body.client_id
    const n8nFormData = new FormData();
    n8nFormData.append('file', file);
    n8nFormData.append('org_id', process.env.DEFAULT_ORG_ID!);
    if (projectId) n8nFormData.append('project_id', projectId);
    if (clientId)  n8nFormData.append('client_id',  clientId);

    console.log('UPLOAD DEBUG', {
        projectId,
        clientId,
      });


    const response = await fetch(process.env.N8N_UPLOAD_WEBHOOK!, {
      method: 'POST',
      body: n8nFormData,
    });

    if (!response.ok) {
      throw new Error('n8n webhook failed');
    }

    const result = await response.json();

    return NextResponse.json({ 
      success: true,
      message: 'Receipt uploaded successfully',
      data: result
    });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload receipt' },
      { status: 500 }
    );
  }
}