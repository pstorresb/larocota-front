import { notFound } from "next/navigation";

const sections = {
  payments: { title: "Pagos", intro: "Los comprobantes enviados por clientes aparecerán aquí para revisión.", empty: "Aún no hay comprobantes." },
} as const;

export default async function AdminSectionPage(props: PageProps<'/admin/[section]'>) {
  const { section } = await props.params;
  const data = sections[section as keyof typeof sections];
  if (!data) notFound();
  return <main className="admin-dashboard admin-list-page"><div className="admin-heading"><div><p className="section-kicker">Operación</p><h1>{data.title}</h1><p>{data.intro}</p></div></div><section className="admin-panel list-panel"><div className="admin-empty-state"><strong>{data.empty}</strong><span>Esta vista permanecerá vacía hasta que exista actividad real.</span></div></section></main>;
}
