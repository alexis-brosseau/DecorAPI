import type { Resource } from '../lib/resource.js';

type AsyncComponentProps = {
  resource: Resource<string>;
};

export default function AsyncComponent({ resource }: AsyncComponentProps) {
  const message = resource.read();

  return (
    <section style={{ padding: '1rem', border: '1px solid #d1fae5', borderRadius: 8, background: '#ecfdf5' }}>
      <h2 style={{ marginTop: 0 }}>Async Component</h2>
      <p>{message}</p>
    </section>
  );
}
