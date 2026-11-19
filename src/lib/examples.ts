import type { Db } from '@/lib/db/client';
import { createProject, createTask, listProjects } from '@/lib/db/repo';
import { addDays, todayIso } from '@/lib/dates';
import type { Priority, Status } from '@/lib/tasks';

/** [title, status, owner, due in days from today (null = no date), priority] */
type T = [string, Status, string, number | null, Priority?];

/** Made-up projects for development, chosen so that some pairs are clearly alike and others are not. */
export const EXAMPLE_PROJECTS: { id: string; name: string; description: string; tasks: T[] }[] = [
  {
    id: 'summit',
    name: 'Customer summit',
    description: 'Two-day customer event at Harbor Hall on 18 and 19 March, with a keynote, two breakout tracks and a customer panel.',
    tasks: [
      ['Sign the venue contract', 'review', 'Maya Chen', 2, 'high'],
      ['Get quotes from two outside caterers', 'doing', 'Priya Nair', 1],
      ['Shortlist keynote speakers', 'doing', 'Jordan Ellis', 6],
      ['Build the registration landing page in HubSpot', 'todo', 'Jordan Ellis', 11, 'high'],
      ['Send save-the-date to customers', 'todo', 'Priya Nair', -1, 'high'],
      ['Book hotel block for speakers', 'todo', 'Tom Becker', 12],
      ['Tour the venue', 'done', 'Priya Nair', -6],
    ],
  },
  {
    id: 'roadshow',
    name: 'Partner roadshow',
    description: 'A series of half-day partner events in three cities to present the new partner programme.',
    tasks: [
      ['Shortlist a venue in each city', 'doing', 'Maya Chen', 4],
      ['Agree catering budget per event', 'todo', 'Tom Becker', 9],
      ['Invite partners through a HubSpot email campaign', 'todo', 'Priya Nair', 14],
      ['Confirm speakers and travel', 'todo', 'Jordan Ellis', null],
      ['Collect feedback after each event', 'todo', 'Unassigned', null, 'low'],
    ],
  },
  {
    id: 'website',
    name: 'Website refresh',
    description: 'Rebuild the marketing website with a new pricing page and customer case studies before the summit invitations go out.',
    tasks: [
      ['Design the pricing page in Figma', 'done', 'Jordan Ellis', -3],
      ['Move content to Contentful', 'doing', 'Tom Becker', 3],
      ['Rebuild pages in Next.js and TypeScript', 'doing', 'Jordan Ellis', 8, 'high'],
      ['Write three customer case studies', 'todo', 'Priya Nair', 10],
      ['Fix the mobile navigation', 'review', 'Tom Becker', 1, 'low'],
      ['SEO review before launch', 'todo', 'Unassigned', 15],
    ],
  },
  {
    id: 'warehouse',
    name: 'Customer data warehouse',
    description: 'Bring CRM, billing and product usage data into one warehouse so finance and sales report from the same numbers.',
    tasks: [
      ['Load Salesforce data into Snowflake', 'doing', 'Sofie Peeters', 5, 'high'],
      ['Model customers and invoices with dbt', 'todo', 'Sofie Peeters', 12],
      ['Schedule pipelines in Airflow', 'todo', 'Lars De Smet', 19],
      ['Agree KPI definitions with finance', 'review', 'Maya Chen', 0, 'high'],
      ['Publish the first Power BI dashboard', 'todo', 'Lars De Smet', 26],
    ],
  },
  {
    id: 'sales-reporting',
    name: 'Sales reporting',
    description: 'Weekly sales dashboards for regional managers, replacing the spreadsheets they maintain by hand.',
    tasks: [
      ['List the KPIs each region needs', 'done', 'Lars De Smet', -8],
      ['Build Power BI dashboards on Snowflake', 'doing', 'Lars De Smet', 6],
      ['Connect Salesforce opportunity data', 'todo', 'Sofie Peeters', 9],
      ['Train regional managers', 'todo', 'Maya Chen', 21],
      ['Retire the Excel reports', 'todo', 'Unassigned', null, 'low'],
    ],
  },
  {
    id: 'support-assistant',
    name: 'Support assistant pilot',
    description: 'Pilot an assistant that answers customer support questions from the help centre, with a human handover.',
    tasks: [
      ['Index help centre articles with embeddings in pgvector', 'doing', 'An Claes', 3],
      ['Build retrieval-augmented generation with Claude', 'todo', 'An Claes', 10, 'high'],
      ['Chat widget in Next.js', 'todo', 'Jordan Ellis', 17],
      ['Measure answer quality on 200 past tickets', 'todo', 'An Claes', 24],
      ['Define the handover to human agents', 'review', 'Tom Becker', -2],
    ],
  },
];

/** Adds the example projects to an empty database. Returns how many were added. */
export async function loadExamples(db: Db, today = todayIso()): Promise<number> {
  if ((await listProjects(db)).length) return 0;
  for (const [i, p] of EXAMPLE_PROJECTS.entries()) {
    await createProject(db, { id: p.id, name: p.name, description: p.description, color: i });
    for (const [title, status, owner, due, priority] of p.tasks) {
      const dueIso = due === null ? null : addDays(today, due);
      await createTask(db, { projectId: p.id, title, status, owner, due: dueIso, start: dueIso ? addDays(dueIso, -7) : null, priority: priority ?? 'medium' });
    }
  }
  return EXAMPLE_PROJECTS.length;
}
