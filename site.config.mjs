export const site = Object.freeze({
  name: 'Tern Bazaar',
  domain: 'ternbazaar.beer',
  repository: 'https://github.com/suj1e/tern-bazaar',
  installSource: 'github.com/suj1e/tern-bazaar',
  description: 'A small, independent collection of useful Tern plugins. Read the code, find your workflow, and install by source.',
});

export function basePath(value = process.env.BASE_PATH ?? '') {
  if (value === '' || value === '/') return '';
  if (!/^\/?[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*\/?$/.test(value)) {
    throw new Error('BASE_PATH must be empty or a path such as /tern-bazaar/');
  }
  return `/${value.replace(/^\/|\/$/g, '')}`;
}
