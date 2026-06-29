import { createServerSupabase } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/config/app-config";
import Link from "next/link";

export default async function UmkmListPage({ searchParams }: { searchParams: Promise<{ [key: string]: string | undefined }> }) {
  const config = await getAppConfig();
  const supabase = await createServerSupabase();
  const params = await searchParams;

  const page = parseInt(params.page || "1"), search = params.search || "", category = params.category || "",
    city = params.city || "", revenue = params.revenue || "", hasNib = params.has_nib || "";
  const pageSize = 50;

  let q = supabase.from("umkm").select("*", { count: "exact" }).eq("is_active", true);
  if (search) q = q.or(`business_name.ilike.%${search}%,full_name.ilike.%${search}%`);
  if (category && category !== "all") q = q.contains("business_category", [category]);
  if (city && city !== "all") q = q.ilike("city", `%${city}%`);
  if (revenue && revenue !== "all") q = q.eq("monthly_revenue_estimate", revenue);
  if (hasNib === "yes") q = q.eq("has_nib", true); else if (hasNib === "no") q = q.eq("has_nib", false);

  const from = (page - 1) * pageSize;
  const { data: umkmList, count } = await q.order("created_at", { ascending: false }).range(from, from + pageSize - 1);
  const totalPages = Math.ceil((count || 0) / pageSize);

  const { data: cats } = await supabase.from("umkm").select("business_category").eq("is_active", true);
  const ucats = [...new Set((cats || []).flatMap((c: any) => c.business_category || []))].sort();
  const { data: cities } = await supabase.from("umkm").select("city").eq("is_active", true).order("city");
  const uCities = [...new Set((cities || []).map((c: any) => c.city))];

  const bu = (p: number) => `/umkm?page=${p}&search=${encodeURIComponent(search)}&category=${category}&city=${city}&revenue=${revenue}&has_nib=${hasNib}`;
  const input = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";
  const sel = "w-full bg-white border border-[var(--border)] rounded-[12px] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,179,107,0.35)]";

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A' }}>
            Data UMKM
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            UMKM Binaan
          </h2>
          <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>{(count || 0).toLocaleString("id-ID")} UMKM terdaftar</p>
        </div>
        <div style={{ marginLeft: 'auto', marginTop: 4 }}>
          <Link href="/umkm/import" className="btn btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 16, height: 16 }}>
              <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            </svg>
            Import CSV
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <form style={{
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'end',
        gap: 12,
        padding: 18,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 18,
        boxShadow: 'var(--shadow)',
        marginBottom: 20,
      }}>
        <div style={{ flex: 1, minWidth: 160 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C4A42', marginBottom: 6, display: 'block' }}>Cari</label>
          <input name="search" defaultValue={search} placeholder="Nama / WA..." className={input} />
        </div>
        <div style={{ minWidth: 130 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C4A42', marginBottom: 6, display: 'block' }}>Kategori</label>
          <select name="category" defaultValue={category} className={sel}>
            <option value="all">Semua</option>
            {ucats.map((c) => <option key={c} value={c}>{c.replace(/_/g, " ")}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C4A42', marginBottom: 6, display: 'block' }}>Kota</label>
          <select name="city" defaultValue={city} className={sel}>
            <option value="all">Semua</option>
            {uCities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div style={{ minWidth: 120 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C4A42', marginBottom: 6, display: 'block' }}>Omzet</label>
          <select name="revenue" defaultValue={revenue} className={sel}>
            <option value="all">Semua</option>
            <option value="<5jt">&lt;5jt</option>
            <option value="5-15jt">5-15jt</option>
            <option value="15-50jt">15-50jt</option>
            <option value=">50jt">&gt;50jt</option>
          </select>
        </div>
        <div style={{ minWidth: 100 }}>
          <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#3C4A42', marginBottom: 6, display: 'block' }}>NIB</label>
          <select name="has_nib" defaultValue={hasNib} className={sel}>
            <option value="all">Semua</option>
            <option value="yes">Punya</option>
            <option value="no">Belum</option>
          </select>
        </div>
        <button type="submit" className="btn btn-primary" style={{ padding: '9px 18px' }}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 15, height: 15 }}>
            <circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" />
          </svg>
          Filter
        </button>
      </form>

      {/* Table */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 18,
        overflow: 'hidden',
        boxShadow: 'var(--shadow)',
      }}>
        <table style={{ width: '100%', fontSize: 14, borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: '#F8F9F5' }}>
              {["Nama Usaha", "Pemilik", "WhatsApp", "Kota", "Kategori", "Omzet", "NIB", ""].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#73837A' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody style={{ borderCollapse: 'collapse' }}>
            {umkmList?.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 48, textAlign: 'center', color: '#73837A' }}>
                  Belum ada data. <Link href="/umkm/import" style={{ color: '#0F3D2B', fontWeight: 600, textDecoration: 'underline' }}>Import CSV →</Link>
                </td>
              </tr>
            )}
            {umkmList?.map((u: any, i: number) => (
              <tr key={u.id} className="hover:bg-[#F8F9F5]" style={{
                borderBottom: '1px solid var(--border-2)',
                transition: 'background 0.15s',
              }}>
                <td style={{ padding: '12px 14px', fontWeight: 700, color: '#152019' }}>
                  <Link href={`/umkm/${u.id}`} className="hover:underline" style={{ color: 'inherit', textDecoration: 'none' }}>
                    {u.business_name}
                  </Link>
                </td>
                <td style={{ padding: '12px 14px', color: '#3C4A42' }}>{u.full_name}</td>
                <td style={{ padding: '12px 14px', color: '#73837A', fontSize: 13, fontFamily: 'monospace' }}>{u.whatsapp}</td>
                <td style={{ padding: '12px 14px', color: '#3C4A42' }}>{u.city}</td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {(u.business_category || []).slice(0, 2).map((c: string) => (
                      <span key={c} style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        fontSize: 11,
                        fontWeight: 600,
                        background: '#F0F2EC',
                        color: '#3C4A42',
                      }}>{c.replace(/_/g, " ")}</span>
                    ))}
                    {(u.business_category || []).length > 2 && (
                      <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 11, color: '#73837A' }}>
                        +{(u.business_category || []).length - 2}
                      </span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '12px 14px', color: '#73837A', fontSize: 13 }}>{u.monthly_revenue_estimate || "-"}</td>
                <td style={{ padding: '12px 14px' }}>
                  {u.has_nib ? (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 700,
                      background: '#DFF5E8',
                      color: '#1F9D5A',
                    }}>Punya</span>
                  ) : (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 11,
                      fontWeight: 600,
                      background: '#F0F2EC',
                      color: '#73837A',
                    }}>Belum</span>
                  )}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <Link href={`/umkm/${u.id}`} className="hover:underline" style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: '#0F3D2B',
                    textDecoration: 'none',
                  }}>
                    Detail →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 20 }}>
          <p style={{ fontSize: 13, color: '#73837A', fontWeight: 600 }}>
            Hal {page} dari {totalPages} • {(count || 0).toLocaleString("id-ID")} UMKM
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {page > 1 && (
              <Link href={bu(page - 1)} className="btn" style={{ padding: '9px 16px', fontSize: 13 }}>
                ← Sebelumnya
              </Link>
            )}
            {page < totalPages && (
              <Link href={bu(page + 1)} className="btn btn-primary" style={{ padding: '9px 16px', fontSize: 13 }}>
                Selanjutnya →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
