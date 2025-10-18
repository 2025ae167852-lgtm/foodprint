// dashboard.js - client side only
(async function () {
  // load Chart.js and jsPDF dynamically from CDN for easier static deploy
  const loadScript = (src) => new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });

  await loadScript('https://cdn.jsdelivr.net/npm/chart.js@4.2.1/dist/chart.umd.min.js');
  await loadScript('https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js');

  // demo data
  const demoRows = [
    { date: '2025-10-01', farmer: 'A. Njoroge', produce: 'Tomato', quantity: 120, location: 'Nairobi' },
    { date: '2025-10-04', farmer: 'B. Kamau', produce: 'Kale', quantity: 75, location: 'Nakuru' },
    { date: '2025-10-05', farmer: 'C. Otieno', produce: 'Beetroot', quantity: 30, location: 'Kisumu' },
    { date: '2025-10-08', farmer: 'D. Mwangi', produce: 'Tomato', quantity: 60, location: 'Nyeri' },
    { date: '2025-10-10', farmer: 'E. Wanjiru', produce: 'Kale', quantity: 90, location: 'Embu' }
  ];

  // populate table
  const tbody = document.querySelector('#harvestTable tbody');
  const renderTable = (rows) => {
    tbody.innerHTML = '';
    rows.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${r.date}</td><td>${r.farmer}</td><td>${r.produce}</td><td>${r.quantity}</td><td>${r.location}</td>`;
      tbody.appendChild(tr);
    });
  };
  renderTable(demoRows);

  // search filter
  document.getElementById('search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    const filtered = demoRows.filter(r => r.produce.toLowerCase().includes(q) || r.farmer.toLowerCase().includes(q) || r.location.toLowerCase().includes(q));
    renderTable(filtered);
    updateChart(filtered);
  });

  // create chart
  const ctx = document.getElementById('harvestChart').getContext('2d');

  const groupByProduce = (rows) => rows.reduce((acc, r) => {
    acc[r.produce] = (acc[r.produce] || 0) + Number(r.quantity);
    return acc;
  }, {});

  let chartInstance;
  const updateChart = (rows) => {
    const grouped = groupByProduce(rows);
    const labels = Object.keys(grouped);
    const data = Object.values(grouped);
    if (chartInstance) {
      chartInstance.data.labels = labels;
      chartInstance.data.datasets[0].data = data;
      chartInstance.update();
      return;
    }
    chartInstance = new Chart(ctx, {
      type: 'bar',
      data: { labels, datasets: [{ label: 'Quantity (kg)', data, backgroundColor: 'rgba(42,157,143,0.8)' }] },
      options: { responsive: true, plugins: { legend: { display: false } } }
    });
  };
  updateChart(demoRows);

  // CSV export
  const toCsv = (rows) => {
    const header = ['date','farmer','produce','quantity','location'];
    const lines = [header.join(',')].concat(rows.map(r => [r.date,r.farmer,r.produce,r.quantity,r.location].map(x => `"${String(x).replace(/"/g,'""')}"`).join(',')));
    return lines.join('\n');
  };
  document.getElementById('download-csv').addEventListener('click', () => {
    const csv = toCsv(demoRows);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'demo-harvest.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  });

  // PDF export using jsPDF
  document.getElementById('download-pdf').addEventListener('click', () => {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: 'px', format: 'a4' });
    doc.setFontSize(18);
    doc.text('FoodPrint — Harvest Report (Demo)', 40, 40);
    doc.setFontSize(12);
    const startY = 70;
    const rowHeight = 20;
    const x = [40,140,300,420,500];
    // header
    doc.setFont(undefined, 'bold');
    ['Date','Farmer','Produce','Quantity','Location'].forEach((h,i)=>doc.text(h,x[i],startY));
    doc.setFont(undefined,'normal');
    demoRows.forEach((r, idx) => {
      const y = startY + (idx+1)*rowHeight;
      [r.date, r.farmer, r.produce, String(r.quantity), r.location].forEach((cell,i) => doc.text(cell, x[i], y));
    });
    doc.save('harvest-report-demo.pdf');
  });

})();
