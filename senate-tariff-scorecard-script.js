/* senate-tariff-scorecard-script.js
   CNL – Senate Tariff Messaging Index
   -----------------------------------
   Requires:
     ├─ jquery   ≥ 3.6.0
     ├─ datatables.net ≥ 1.13.4
     └─ papaparse ≥ 5.4.1
*/

(() => {
  'use strict';

  /* ---------- 1.  DataTables ordering plug-in ---------- */
  $.fn.dataTable.ext.order['grade-data'] = function (settings, colIdx) {
    return this.api()
      .column(colIdx, { order: 'index' })
      .nodes()
      .map(td => {
        const v = $(td).attr('data-order');
        return v !== undefined ? parseInt(v, 10) : 999;
      });
  };

  /* ---------- 2.  Helper constants & utilities ---------- */

  // Numeric rank for every possible grade (lower = better)
  const ORDER_MAP = {
    'A+': 1, 'A': 2, 'A-': 3,
    'B' : 4,
    'C' : 5,
    'D' : 6,
    'F' : 7,
    'No Record': 99, '–': 99
  };

  // Normalise grade strings into CSS-friendly keys
  const cssKey = g => g === 'A+' ? 'Aplus' : g.replace('+', 'plus').replace('-', 'minus');

  // Render a coloured grade circle or “–” if no record
  const gradeCircle = g => {
    g = (g || '').trim();
    return (g === 'No Record' || g === '–' || g === '')
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
      'A' : 'Ally',
      'A-': 'Defender',
      'B' : 'Good',
      'C' : 'Okay',
      'D' : 'Poor',
      'F' : 'Protectionist'
    };
    const key   = cssKey(g);
    const label = TEXT_MAP[g] ?? g;

    return `
      <span class="overall-pill">
        <span class="grade-circle grade-${key}">${g || '–'}</span>
        <span class="grade-label">${label}</span>
      </span>`;
  }

  /* ---------- 3.  DataTable initialisation ---------- */

  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQaiqHpsgzBh1dcGZCqO0GG1cTa6gfArPxuuo4AhYcrlijksH4aqeRnY2r18FeTwa_1jJojRSCHLu-y/pub?gid=0&single=true&output=csv';

  const table = $('#scorecard-table').DataTable({
    paging   : false,
    info     : false,
    autoWidth: false,
    dom      : 'frt',
    order    : [[9, 'asc']], // sort by overall grade by default
    columnDefs: [
      { targets: 0, width: '160px' }, // name
      { targets: 1, width: '80px'  }, // state
      { targets: 2, orderDataType: 'grade-data', width: '60px' },  // Pre-Trump
      { targets: 3, orderDataType: 'grade-data', width: '60px' },  // Pass/Fail
      { targets: [4, 5, 6, 7, 8], orderDataType: 'grade-data', width: '60px' },
      { targets: 9, orderDataType: 'grade-data', width: '200px' }
    ],
    createdRow: (row, data) => {
      /* Col 2 – Pre-Trump grade */
      const g2 = (data[2] || '').trim();
      $('td:eq(2)', row)
        .attr('data-order', ORDER_MAP[g2] ?? 999)
        .html(gradeCircle(g2));

      /* Col 3 – Pass / Fail */
      const pf = data[3];
      $('td:eq(3)', row)
        .attr('data-order', (pf || '').toString().toLowerCase() === 'pass' ? 0 : 1)
        .html(passFail(pf));

      /* Cols 4-8 – Response/messaging grades */
      [4, 5, 6, 7, 8].forEach(idx => {
        const g = (data[idx] || '').trim();
        $('td:eq(' + idx + ')', row)
          .attr('data-order', ORDER_MAP[g] ?? 999)
          .html(gradeCircle(g));
      });

      /* Col 9 – Overall pill */
      const ov = (data[9] || '').trim();
      $('td:eq(9)', row)
        .attr('data-order', ORDER_MAP[ov] ?? 999)
        .html(buildOverallPill(ov));
    }
  });

  /* ---------- 4.  Load data from CSV (Papa Parse) ---------- */
  Papa.parse(CSV_URL, {
    download: true,
    header: false, // columns A..K, raw
    skipEmptyLines: true,
    complete: function(results) {
      // Expecting columns:
      // 0 Name, 1 Party/State, 2 Pre-Trump, 3 Pass/Fail, 4 SJR81, 5 SJR77, 6 SJR88, 7 232/301, 8 Messaging, 9 Final, 10 Description
      const rows = results.data;

      // If the first row looks like headers, drop it
      const maybeHeader = rows[0] || [];
      const looksHeader = (maybeHeader[0] || '').toLowerCase().includes('name');
      const dataRows = looksHeader ? rows.slice(1) : rows;

      dataRows.forEach(r => {
        // Safety pad
        for (let i = 0; i < 11; i++) if (typeof r[i] === 'undefined') r[i] = '';

        // Normalize "No Record" / blanks
        const norm = (x) => {
          const v = (x || '').toString().trim();
          if (v === '-' || v === '–' || v === '') return 'No Record';
          return v;
        };

        const row = [
          r[0],        // Name
          r[1],        // Party/State (displayed as State text in header)
          norm(r[2]),  // Pre-Trump
          (r[3] || '').trim(), // Pass/Fail
          norm(r[4]),  // SJR81
          norm(r[5]),  // SJR77
          norm(r[6]),  // SJR88
          norm(r[7]),  // 232/301
          norm(r[8]),  // Messaging
          norm(r[9]),  // Final Grade
          (r[10] || '') // Description/Reasoning
        ];

        table.row.add(row);
      });

      table.draw();

      // Build state filter options from Party/State (D-CO -> CO)
      const states = new Set();
      table.column(1).data().each(v => {
        const parts = (v || '').toString().split('-');
        if (parts.length === 2) states.add(parts[1].trim());
      });
      [...states].sort().forEach(st => {
        $('#state-filter').append(`<option value="${st}">${st}</option>`);
      });
    }
  });

  /* ---------- 5.  State filter binding ---------- */
  $('#state-filter').on('change', function () {
    const val = this.value;
    if (!val) {
      // clear filter
      table.column(1).search('').draw();
    } else {
      // search for dash + state end (e.g., "-CO")
      table.column(1).search(`-${val}$`, true, false).draw();
    }
  });

  /* ---------- 6.  Row click → modal ---------- */
  $('#scorecard-table tbody').on('click', 'tr', function () {
    const rowData = table.row(this).data();
    if (!rowData) return;

    const [
      name, partyState,
      pt, authority, sjr81, sjr77, sjr88, sec232301, messaging,
      overall, reason
    ] = rowData;

    // Header
    $('.detail-name').text(name);
    $('.detail-district').text(partyState);

    // Criteria
    $('.detail-pt').html(gradeCircle(pt));
    $('.detail-sa').html(passFail(authority));
    $('.detail-brazil').html(gradeCircle(sjr81));
    $('.detail-canada').html(gradeCircle(sjr77));
    $('.detail-ieepa').html(gradeCircle(sjr88));
    $('.detail-232301').html(gradeCircle(sec232301));
    $('.detail-msg').html(gradeCircle(messaging));

    // Overall
    $('#detail-overall-css').html(buildOverallPill(overall));

    // Reasoning
    $('.detail-reason').text(reason || '');

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
