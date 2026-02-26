export interface Resource<T> {
  read: () => T;
}

export function createResource<T>(loader: () => Promise<T>): Resource<T> {
  let status: 'pending' | 'success' | 'error' = 'pending';
  let result: T;
  let error: unknown;

  const promise = loader().then(
    (value) => {
      status = 'success';
      result = value;
    },
    (err) => {
      status = 'error';
      error = err;
    },
  );

  return {
    read() {
      if (status === 'pending') {
        throw promise;
      }

      if (status === 'error') {
        throw error;
      }

      return result;
    },
  };
}
