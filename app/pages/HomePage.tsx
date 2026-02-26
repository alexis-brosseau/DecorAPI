import { Suspense } from 'react';
import type { Resource } from '../lib/resource.js';
import Skeleton from '../components/Skeleton.js';
import AsyncComponent from '../components/AsyncComponent.js';

type HomePageProps = {
  resource: Resource<string>;
};

export default function HomePage({ resource }: HomePageProps) {
  return (
    <>
      <p>This page is streamed with React SSR.</p>
      <Suspense fallback={<Skeleton />}>
        <AsyncComponent resource={resource} />
      </Suspense>
    </>
  );
}
