import { createServerSupabase } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/config/app-config";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function UmkmDetailPage({ params, searchParams }: { params: Promise<{ id: string }>, searchParams: Promise<{ returnTo?: string }> }) {
  const config = await getAppConfig();
  const supabase = await createServerSupabase();
  const { id } = await params;
  const { data: u, error } = await supabase.from("umkm").select("*").eq("id", id).single();
  if (error || !u) notFound();
  const { returnTo } = await searchParams;
  const { data: evt } = await supabase.from("event_invitations").select("status, events!inner(title, start_date)").eq("umkm_id", id).order("sent_at", { ascending: false });
  const { data: chat } = await supabase.from("wa_conversations").select("direction, content, intent, created_at").eq("umkm_id", id).order("created_at", { ascending: false }).limit(20);

  const sections = [
    {
      t: "Profil Dasar",
      f: [
        ["Nama", u.full_name], ["WA", u.whatsapp], ["Email", u.email],
        ["Kota", u.city], ["Usaha", u.business_name], ["Thn Berdiri", u.year_established],
        ["Omzet", u.monthly_revenue_estimate], ["Karyawan", u.employee_count],
        ["Kategori", (u.business_category || []).join(", ").replace(/_/g, " ")],
      ],
    },
    {
      t: "Kurasi",
      f: [
        ["Laba", u.avg_net_profit_monthly],
        ["Pisah Rekening", u.separates_business_account ? "Ya" : "Tidak"],
        ["Pembukuan", u.accounting_method], ["Stabilitas", u.income_stability],
        ["Target Growth", u.has_growth_target_1_2yr ? "Ya" : "Tidak"],
        ["NIB", u.has_nib ? "✅" : "❌"],
        ["Brand", (u.brand_completeness || []).join(", ") || "-"],
        ["Channel", (u.marketing_channels || []).join(", ") || "-"],
        ["QRIS", u.uses_qris ? "Ya" : "Tidak"],
        ["Smartphone", u.uses_smartphone_for_business ? "Ya" : "Tidak"],
        ["Frekuensi Pelatihan", u.training_frequency_last_year],
        ["Pendidikan", u.education_level], ["Tantangan", u.biggest_challenge],
        ["Solusi", u.most_needed_solution],
        ["Bersedia Langganan", u.willing_to_subscribe_100k ? "Ya" : "Tidak"],
        ["Sumber", u.info_source],
      ],
    },
    {
      t: "Sosmed",
      f: [
        ["IG", u.instagram_handle ? `@${u.instagram_handle}` : "-"],
        ["TikTok", u.tiktok_handle ? `@${u.tiktok_handle}` : "-"],
        ["Shopee", u.shopee_shop_name || "-"],
        ["Tokopedia", u.tokopedia_shop_name || "-"],
      ],
    },
  ];

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Back + Header */}
      <Link href={returnTo || "/umkm"} className="hover:text-[#152019]" style={{
        fontSize: 13,
        color: '#73837A',
        fontWeight: 600,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        marginBottom: 12,
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
          <path d="M19 12H5M12 19l-7-7 7-7" />
        </svg>
        Kembali
      </Link>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 18, marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A', marginBottom: 4 }}>
            Detail UMKM
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em' }}>
            {u.business_name}
          </h2>
          <p style={{ color: '#73837A', fontSize: 14, marginTop: 4 }}>
            {u.full_name} • {u.city}
          </p>
        </div>
        <span style={{
          padding: '4px 12px',
          borderRadius: 999,
          fontSize: 12,
          fontWeight: 700,
          background: u.is_active ? '#DFF5E8' : '#F0F2EC',
          color: u.is_active ? '#1F9D5A' : '#73837A',
        }}>
          {u.is_active ? "Aktif" : "Nonaktif"}
        </span>
      </div>

      {/* Info sections */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {sections.map((s) => (
          <div key={s.t} style={{
            background: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 18,
            overflow: 'hidden',
            boxShadow: 'var(--shadow)',
          }}>
            <div style={{
              padding: '14px 20px',
              borderBottom: '1px solid var(--border)',
              background: '#F8F9F5',
            }}>
              <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{s.t}</h3>
            </div>
            <div style={{ borderCollapse: 'collapse' }}>
              {s.f.map(([l, v], fi) => (
                <div key={fi} className="hover:bg-[#F8F9F5]" style={{
                  display: 'flex',
                  padding: '10px 20px',
                  borderBottom: fi < s.f.length - 1 ? '1px solid var(--border-2)' : 'none',
                  transition: 'background 0.12s',
                }}>
                  <span style={{ width: 180, fontSize: 13, color: '#73837A', flexShrink: 0 }}>{l}</span>
                  <span style={{ fontSize: 14, color: '#152019' }}>
                    {v || <span style={{ color: '#D1D5DB', fontStyle: 'italic' }}>—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Riwayat Event */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: '#F8F9F5',
          }}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Riwayat Event</h3>
          </div>
          {evt && evt.length > 0 ? (
            <div>
              {evt.map((e: any, i: number) => (
                <div key={i} className="hover:bg-[#F8F9F5]" style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 20px',
                  borderBottom: i < evt.length - 1 ? '1px solid var(--border-2)' : 'none',
                  transition: 'background 0.12s',
                }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#152019' }}>{e.events?.title}</span>
                  <span style={{ fontSize: 12.5, color: '#73837A' }}>{e.events?.start_date}</span>
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 600,
                    background: e.status === "attended" || e.status === "rsvp_yes" ? '#DFF5E8' : '#F0F2EC',
                    color: e.status === "attended" || e.status === "rsvp_yes" ? '#1F9D5A' : '#73837A',
                  }}>
                    {e.status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#73837A' }}>
              Belum ada riwayat
            </div>
          )}
        </div>

        {/* Riwayat Chat */}
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          overflow: 'hidden',
          boxShadow: 'var(--shadow)',
        }}>
          <div style={{
            padding: '14px 20px',
            borderBottom: '1px solid var(--border)',
            background: '#F8F9F5',
          }}>
            <h3 style={{ fontFamily: 'var(--font-sora)', fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>Percakapan WhatsApp</h3>
          </div>
          {chat && chat.length > 0 ? (
            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {chat.map((c: any) => (
                <div key={c.id} style={{
                  padding: '10px 12px',
                  borderRadius: 12,
                  fontSize: 13,
                  lineHeight: 1.45,
                  ...(c.direction === "inbound"
                    ? { background: '#DFF5E8', border: '1px solid #A8DFC1', marginRight: 32 }
                    : { background: '#F8F9F5', border: '1px solid var(--border)', marginLeft: 32 }),
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      color: c.direction === "inbound" ? '#1F9D5A' : '#3C4A42',
                    }}>
                      {c.direction === "inbound" ? "UMKM" : config.wa_bot_name}
                    </span>
                    {c.intent && (
                      <span style={{ fontSize: 10, color: '#73837A', padding: '1px 6px', borderRadius: 4, background: '#fff' }}>
                        {c.intent}
                      </span>
                    )}
                    <span style={{ fontSize: 10, color: '#73837A', marginLeft: 'auto' }}>
                      {new Date(c.created_at).toLocaleString("id-ID")}
                    </span>
                  </div>
                  <p style={{ color: '#152019' }}>{c.content}</p>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: '#73837A' }}>
              Belum ada percakapan
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
