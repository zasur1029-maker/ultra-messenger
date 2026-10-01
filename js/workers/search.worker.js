self.onmessage = (e) => {
  const { query, items, field } = e.data;
  if (!query || !items) { self.postMessage({ results: items || [] }); return; }
  const q = query.toLowerCase();
  const results = items.filter((item) => {
    const v = (field ? item[field] : JSON.stringify(item)) || '';
    return String(v).toLowerCase().includes(q);
  });
  self.postMessage({ results });
};
