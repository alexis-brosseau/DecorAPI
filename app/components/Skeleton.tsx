export default function Skeleton() {
  return (
    <section aria-busy="true" aria-live="polite" style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ width: 160, height: 16, background: '#e5e7eb', borderRadius: 4, marginBottom: 12 }} />
      <div style={{ width: '100%', maxWidth: 420, height: 12, background: '#f3f4f6', borderRadius: 4, marginBottom: 8 }} />
      <div style={{ width: '80%', maxWidth: 360, height: 12, background: '#f3f4f6', borderRadius: 4 }} />
    </section>
  );
}
