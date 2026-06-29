import { createServerSupabase } from "@/lib/supabase/server";
import { getAppConfig } from "@/lib/config/app-config";

export default async function WaInboxPage() {
  const config = await getAppConfig();
  const supabase = await createServerSupabase();
  const { data: conversations } = await supabase
    .from("wa_conversations")
    .select("*, umkm!inner(business_name, full_name, whatsapp)")
    .order("created_at", { ascending: false })
    .limit(100);

  const grouped = (conversations || []).reduce(
    (acc: Record<string, any[]>, msg: any) => {
      const k = msg.umkm_id;
      if (!acc[k]) acc[k] = [];
      acc[k].push(msg);
      return acc;
    },
    {}
  );

  return (
    <div style={{ animation: 'fade-in-up 0.5s ease-out both' }}>
      {/* Page Head */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 18, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: '#1F9D5A' }}>
            Pesan WhatsApp
          </div>
          <h2 style={{ fontFamily: 'var(--font-sora)', fontSize: 34, fontWeight: 800, letterSpacing: '-0.02em', marginTop: 6 }}>
            Inbox
          </h2>
          <p style={{ color: '#73837A', fontSize: 13.5, marginTop: 6 }}>
            Pantau percakapan dengan UMKM. Muncul saat UMKM chat ke bot.
          </p>
        </div>
      </div>

      {Object.keys(grouped).length === 0 && (
        <div style={{
          background: '#fff',
          border: '1px solid var(--border)',
          borderRadius: 18,
          padding: 48,
          textAlign: 'center',
          boxShadow: 'var(--shadow)',
        }}>
          <p style={{ color: '#73837A', fontSize: 14 }}>Belum ada percakapan.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {Object.entries(grouped).map(([uid, msgs], i) => {
          const lm = msgs[0];
          const u = lm?.umkm;
          const hasEscalated = msgs.some((m: any) => m.escalated);
          return (
            <div key={uid} style={{
              background: '#fff',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 20,
              boxShadow: 'var(--shadow)',
              transition: 'all 0.2s',
              animation: 'fade-in-up 0.5s ease-out both',
              animationDelay: `${(i % 6) * 0.05}s`,
            }} className="card-hover">
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <h3 style={{
                    fontFamily: 'var(--font-sora)',
                    fontSize: 18,
                    fontWeight: 700,
                    color: '#152019',
                  }}>
                    {u?.business_name || "Unknown"}
                  </h3>
                  <p style={{ fontSize: 12.5, color: '#73837A', marginTop: 2 }}>
                    {u?.full_name} • {u?.whatsapp}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {hasEscalated && (
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 999,
                      fontSize: 10.5,
                      fontWeight: 700,
                      background: '#FEE2E2',
                      color: '#991B1B',
                    }}>
                      ⚠ Perlu Respon
                    </span>
                  )}
                  <span style={{ fontSize: 11, color: '#73837A', whiteSpace: 'nowrap' }}>
                    {new Date(lm?.created_at).toLocaleString("id-ID")}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {msgs.slice(0, 4).reverse().map((m: any) => (
                  <div key={m.id} style={{
                    padding: '10px 12px',
                    borderRadius: 12,
                    fontSize: 13,
                    lineHeight: 1.45,
                    ...(m.direction === "inbound"
                      ? { background: '#DFF5E8', border: '1px solid #A8DFC1', marginRight: 48 }
                      : { background: '#F8F9F5', border: '1px solid var(--border)', marginLeft: 48 }),
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: m.direction === "inbound" ? '#1F9D5A' : '#3C4A42',
                      }}>
                        {m.direction === "inbound" ? "UMKM" : config.wa_bot_name}
                      </span>
                      {m.intent && (
                        <span style={{
                          fontSize: 10,
                          color: '#73837A',
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: '#fff',
                        }}>
                          {m.intent}
                        </span>
                      )}
                    </div>
                    <p style={{ color: '#152019' }}>{m.content}</p>
                  </div>
                ))}
                {msgs.length > 4 && (
                  <p style={{ fontSize: 11, color: '#73837A', textAlign: 'center' }}>
                    +{msgs.length - 4} lainnya
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
