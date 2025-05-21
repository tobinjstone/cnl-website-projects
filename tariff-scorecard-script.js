/* tariff-scorecard.js
   Center for New Liberalism – Congressional Tariff Messaging Index
   ---------------------------------------------------------------
   Requires:
     ├─ jquery   ≥ 3.6.0
     └─ datatables.net ≥ 1.13.4
   Place a table with id="scorecard-table", a select with id="state-filter",
   and a #detail-modal element (see markup in your original page).
*/

(() => {
  'use strict';

  /* ---------- 1.  DataTables ordering plug-in ---------- */
  $.fn.dataTable.ext.order['grade-data'] = function (settings, colIdx) {
    return this.api()
      .column(colIdx, { order: 'index' })
      .nodes()
      .map(td => {
        const v = $(td).data('order');
        return v === undefined ? 0 : v;
      })
      .toArray();
  };

  /* ---------- 2.  Helper constants & utilities ---------- */

  // Numeric rank for every possible grade (lower = better)
  const ORDER_MAP = {
    'A+': 1, 'A': 2,
    'B' : 3,
    'C' : 4,
    'D' : 5,
    'F' : 6,
    'No Record': 7, '–': 7
  };

  // Normalise grade strings into CSS-friendly keys
  const cssKey = g => g === 'A+' ? 'Aplus' : g.replace('+', 'plus').replace('-', 'minus');

  // Render a coloured grade circle or “–” if no record
  const gradeCircle = g => {
    g = (g || '').trim();
    return (g === 'No Record' || g === '–')
      ? '<span class="grade-circle no-record">–</span>'
      : `<span class="grade-circle grade-${cssKey(g)}">${g}</span>`;
  };

  // Render Pass / Fail label
  const passFail = v =>
    (v || '').toString().trim().toLowerCase() === 'pass'
      ? '<span class="pass">Pass</span>'
      : '<span class="fail">Fail</span>';

  // Build the combined overall “pill”
  function buildOverallPill(g) {
    const TEXT_MAP = {
      'A+': 'Champion',
      'A' : 'Great',
      'B' : 'Good',
      'C' : 'Okay',
      'D' : 'Poor',
      'F' : 'Fail'
    };
    const key   = cssKey(g);
    const label = TEXT_MAP[g] ?? g;

    return `
      <span class="overall-pill overall-${key}">
        <span class="grade-circle">${g}</span>
        <span class="grade-label">${label}</span>
      </span>`;
  }

  /* ---------- 3.  DataTable initialisation ---------- */

  const SHEET_ID   = '1Kptpi3Rc2DydW4P7hkABFS0IsgOyIoFFixnGBGzNVp4';
  const SHEET_NAME = 'Sheet1';
  const URL        = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${SHEET_NAME}`;

  const table = $('#scorecard-table').DataTable({
    paging   : false,
    info     : false,
    autoWidth: false,
    dom      : 'frt',
    columnDefs: [
      { targets: 2, orderDataType: 'grade-data', width: '60px' },  // Pre-Trump
      { targets: 3, orderDataType: 'grade-data', width: '60px' },  // Pass/Fail
      { targets: [4, 5, 6, 7], orderDataType: 'grade-data', width: '60px' },
      { targets: 8, orderDataType: 'grade-data', width: '200px' }
    ],
    createdRow: (row, data) => {
      /* Col 2 – Pre-Trump grade */
      const g2 = data[2].trim();
      $('td:eq(2)', row)
        .attr('data-order', ORDER_MAP[g2] ?? 0)
        .html(gradeCircle(g2));

      /* Col 3 – Pass / Fail */
      const pf = data[3];
      $('td:eq(3)', row)
        .attr('data-order', pf.toString().toLowerCase() === 'pass' ? 0 : 1)
        .html(passFail(pf));

      /* Cols 4-7 – Response grades */
      [4, 5, 6, 7].forEach(idx => {
        const g = data[idx].trim();
        $('td:eq(' + idx + ')', row)
          .attr('data-order', ORDER_MAP[g] ?? 0)
          .html(gradeCircle(g));
      });

      /* Col 8 – Overall pill */
      const ov = data[8].trim();
      $('td:eq(8)', row)
        .attr('data-order', ORDER_MAP[ov] ?? 0)
        .html(buildOverallPill(ov));
    }
  });

  /* ---------- 4.  Load data from Google Sheets ---------- */

  $.get(URL, res => {
    const json = JSON.parse(res.substr(47).slice(0, -2)); // strip Google wrapper
    json.table.rows.forEach(r => {
      table.row.add(r.c.map(c => (c && c.v != null ? c.v : '')));
    });
    table.draw();

    // Build state filter options
    const states = new Set();
    table.column(1).data().each(v => states.add(v.split(' /')[0]));
    states.forEach(s => $('#state-filter').append(`<option>${s}</option>`));
  });

  /* ---------- 5.  Search + State filter ---------- */

  $('#scorecard-table_filter input').on('keyup', function () {
    table.search(this.value).draw();
  });

  $('#state-filter').on('change', function () {
    const v = $.fn.dataTable.util.escapeRegex(this.value);
    table.column(1).search(v ? '^' + v : '', true, false).draw();
  });

  /* ---------- 6.  Row-click modal ---------- */

  $('#scorecard-table tbody').on('click', 'tr', function () {
    const d = table.row(this).data();
    if (!d) return; // placeholder row

    $('.detail-name')      .text(d[0] || '');
    $('.detail-district')  .text(d[1] || '');
    $('.detail-pt')        .html(gradeCircle(d[2]));
    $('.detail-sa')        .html(passFail(d[3]));
    $('.detail-canada')    .html(gradeCircle(d[4]));
    $('.detail-mexico')    .html(gradeCircle(d[5]));
    $('.detail-liberation').html(gradeCircle(d[6]));
    $('.detail-strategic') .html(gradeCircle(d[7]));
    $('.detail-overall')   .html(buildOverallPill(d[8].trim()));
    $('.detail-reason')    .text(d[9] || '');

    $('#detail-modal').addClass('open');
  });

  // Close modal (✕ button, click outside, or Esc)
  $('.detail-close, #detail-modal').on('click', function (e) {
    if (e.target === this || $(e.target).hasClass('detail-close')) {
      $('#detail-modal').removeClass('open');
    }
  });
  $(document).on('keyup', e => {
    if (e.key === 'Escape') $('#detail-modal').removeClass('open');
  });
})();
