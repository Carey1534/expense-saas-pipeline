import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getProjectById } from '@/lib/db';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const project = await getProjectById(projectId);
    if (!project) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(project);
  } catch (error) {
    console.error('Error fetching project:', error);
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 });
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ projectId: string }> }
) {
  try {
    const { projectId } = await params;
    const body = await req.json();

    const allowed = ['name', 'budget'] as const;
    const fields: Record<string, unknown> = {};
    for (const key of allowed) {
      if (body[key] !== undefined) fields[key] = body[key];
    }

    // Validate name if provided
    if ('name' in fields && !String(fields.name).trim()) {
      return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
    }
    // Coerce budget to number or null
    if ('budget' in fields) {
      const b = fields.budget;
      fields.budget = (b === null || b === '' || b === undefined) ? null : Number(b);
    }

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('tc_projects')
      .update(fields)
      .eq('id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Error updating project:', error);
    return NextResponse.json({ error: 'Failed to update project' }, { status: 500 });
  }
}
