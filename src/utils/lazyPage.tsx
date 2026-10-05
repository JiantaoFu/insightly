import React, { lazy } from 'react';

/**
 * React.lazy() with a preload() hook.
 *
 * Plain React.lazy always suspends on its first render, even when the chunk is
 * already in the browser, which would swap the prerendered HTML in #root for
 * the Suspense spinner for a frame. main.tsx calls preload() for the current
 * route *before* the first render; once loaded, the component renders
 * synchronously and React replaces the prerendered markup with the real page
 * in one commit (no spinner, no duplicate <h1>).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyComponent = React.ComponentType<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type PreloadableComponent = React.FC<any> & { preload: () => Promise<unknown> };

export function lazyPage(factory: () => Promise<{ default: AnyComponent }>): PreloadableComponent {
  let Loaded: AnyComponent | null = null;
  let promise: Promise<{ default: AnyComponent }> | null = null;
  const load = () => {
    if (!promise) {
      promise = factory().then((m) => {
        Loaded = m.default;
        return m;
      });
    }
    return promise;
  };
  const Lazy = lazy(load);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const Page = ((props: any) => (Loaded ? React.createElement(Loaded, props) : React.createElement(Lazy, props))) as unknown as PreloadableComponent;
  Page.preload = load;
  return Page;
}
