import { redirect } from "next/navigation";

export default async function CertificateRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/api/certificates/${id}`);
}
