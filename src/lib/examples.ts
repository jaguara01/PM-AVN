import type { Db } from '@/lib/db/client';
import { createProject, createTask, listProjects } from '@/lib/db/repo';

/** Made-up projects for development, chosen so that some pairs are clearly alike and others are not. */
export const EXAMPLE_PROJECTS: { id: string; name: string; description: string; tasks: string[] }[] = [
  {
    id: 'summit',
    name: 'Customer summit',
    description: 'Two-day customer event at Harbor Hall on 18 and 19 March, with a keynote, two breakout tracks and a customer panel.',
    tasks: ['Sign the venue contract', 'Get quotes from two outside caterers', 'Shortlist keynote speakers', 'Build the registration landing page in HubSpot', 'Send save-the-date to customers', 'Book hotel block for speakers'],
  },
  {
    id: 'roadshow',
    name: 'Partner roadshow',
    description: 'A series of half-day partner events in three cities to present the new partner programme.',
    tasks: ['Shortlist a venue in each city', 'Agree catering budget per event', 'Invite partners through a HubSpot email campaign', 'Confirm speakers and travel', 'Collect feedback after each event'],
  },
  {
    id: 'website',
    name: 'Website refresh',
    description: 'Rebuild the marketing website with a new pricing page and customer case studies before the summit invitations go out.',
    tasks: ['Design the pricing page in Figma', 'Move content to Contentful', 'Rebuild pages in Next.js and TypeScript', 'Write three customer case studies', 'Fix the mobile navigation', 'SEO review before launch'],
  },
  {
    id: 'warehouse',
    name: 'Customer data warehouse',
    description: 'Bring CRM, billing and product usage data into one warehouse so finance and sales report from the same numbers.',
    tasks: ['Load Salesforce data into Snowflake', 'Model customers and invoices with dbt', 'Schedule pipelines in Airflow', 'Agree KPI definitions with finance', 'Publish the first Power BI dashboard'],
  },
  {
    id: 'sales-reporting',
    name: 'Sales reporting',
    description: 'Weekly sales dashboards for regional managers, replacing the spreadsheets they maintain by hand.',
    tasks: ['List the KPIs each region needs', 'Build Power BI dashboards on Snowflake', 'Connect Salesforce opportunity data', 'Train regional managers', 'Retire the Excel reports'],
  },
  {
    id: 'support-assistant',
    name: 'Support assistant pilot',
    description: 'Pilot an assistant that answers customer support questions from the help centre, with a human handover.',
    tasks: ['Index help centre articles with embeddings in pgvector', 'Build retrieval-augmented generation with Claude', 'Chat widget in Next.js', 'Measure answer quality on 200 past tickets', 'Define the handover to human agents'],
  },
];

/** Adds the example projects to an empty database. Returns how many were added. */
export async function loadExamples(db: Db): Promise<number> {
  if ((await listProjects(db)).length) return 0;
  for (const [i, p] of EXAMPLE_PROJECTS.entries()) {
    await createProject(db, { id: p.id, name: p.name, description: p.description, color: i });
    for (const title of p.tasks) await createTask(db, { projectId: p.id, title });
  }
  return EXAMPLE_PROJECTS.length;
}
