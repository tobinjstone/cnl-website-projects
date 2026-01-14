/* CNL Senate Tariff Messaging Index 2026 
   --------------------------------------
   Updated for 11-column Senate Google Sheet Structure
*/

(() => {
  'use strict';

  /* ---------- 1. Configuration & Data Source ---------- */
  const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQaiqHpsgzBh1dcGZCqO0GG1cTa6gfArPxuuo4AhYcrlijksH4aqeRnY2r18FeTwa_1jJojRSCHLu-y/pub?gid=0&single=true&output=csv';

  // Numeric rank for sorting (lower = better)
  const ORDER_MAP = {
    'A+': 1, 'A': 2, 'B': 3, 'C': 4, 'D': 5, 'F': 6,
    'No Record': 7, 'NS': 7, '–': 7, '': 8
  };

  /* ---------- 2. Helper Utilities ---------- */

  // Normalise grade strings into CSS-friendly keys (e.g., "A+" -> "Aplus")
  const cssKey = g => g === 'A+' ? 'Aplus' : g.replace('+', 'plus').replace('-', 'minus');

  // Helper to parse CSV lines correctly (handles commas inside quotes)
  function parseCSVLine(text) {
    const regex = /,(?=(?:(?:[^"]*"){2})*[^"]*$)/;
    return text.split(regex).map(val => val.replace(/^"|"$/g, '').trim());
  }

  // Render a coloured grade circle
  const gradeCircle = g => {
    const val = (g || '').trim();
    // Use gray "no-record" style for NS (New Senator) or empty values
    if (val === 'NS' || val === 'No Record' || val === '–' || val === '') {
      return `<span class="grade-circle no-record" title="No Record / New Senator">–</span>`;
    }
    return `<span class="grade-circle grade-${cssKey(val)}">${val}</span>`;
  };

  // Render Pass / Fail label (used for the "Congressional Authority" column)
  const passFail = v => {
    const val = (v || '').toString().trim().toLowerCase();
    if (val === 'pass') return '<span class="pass">Pass</span>';
    if (val === 'fail') return '<span class="fail">Fail</span>';
    return '<span class="grade-circle no-record">–</span>';
  };

  // Build the combined overall “pill” for the Final Grade
  function buildOverallPill(g) {
    const TEXT_MAP = {
      'A+': 'Champion', 'A': 'Great', 'B': 'Good',
      'C': 'Okay', 'D': 'Poor', 'F': 'Fail'
    };
    const val = (g || '').trim();
    const key = cssKey(val);
    const label = TEXT_MAP[val] ?? val;

    return `
      <span class="overall-pill overall-${key}">
        <span class="grade-circle">${val}</span>
        <span class="grade-label">${label}</span>
      </span>`;
  }

  /* ---------- 3. DataTable Initialization ---------- */

  // Custom ordering for grades
  $.fn.dataTable.ext.order['grade-data'] = function (settings, colIdx) {
    return this.api().column(colIdx, { order: 'index' }).nodes().map(td => {
      const v = $(td).attr('data-order');
      return v !== undefined ? parseInt(v, 10) : 99;
    }).toArray();
  };

  const table = $('#scorecard-table').DataTable({
    paging: false,
    info: false,
    autoWidth: false,
    dom: '<"top-search-area"f>rt',
initComplete: function() {
        // 1. Initialize Tippy Tooltips
        tippy('[data-tippy-content]', {
            theme: 'cnl-navy',
            placement: 'top',
            arrow: true,
        });

        // 2. Move Search Bar ABOVE the Filters
        const searchBar = $('.dataTables_filter');
        const filtersDiv = $('.filters');

        if (searchBar.length && filtersDiv.length) {
            searchBar.insertBefore(filtersDiv);
        }
    },
    columnDefs: [
      { targets: [2, 4, 5, 6, 7, 8], orderDataType: 'grade-data' }, // Grade circles
      { targets: 3, orderDataType: 'grade-data' },                  // Pass/Fail
      { targets: 9, orderDataType: 'grade-data' }                   // Overall Pill
    ],
    createdRow: (row, data) => {
      // Data Mapping based on your 11-column Sheet:
      // 0:Name, 1:Party/State, 2:PreTrump, 3:Auth, 4:SJ81, 5:SJ77, 6:SJ88, 7:Sec232, 8:Messaging, 9:FinalGrade, 10:Reason

      // Col 2, 4, 5, 6, 7, 8 (Grade Circles)
      [2, 4, 5, 6, 7, 8].forEach(idx => {
        const val = data[idx];
        $('td:eq(' + idx + ')', row)
          .attr('data-order', ORDER_MAP[val] ?? 99)
          .html(gradeCircle(val));
      });

      // Col 3 (Pass / Fail)
      const pf = data[3];
      $('td:eq(3)', row)
        .attr('data-order', pf.toLowerCase() === 'pass' ? 0 : 1)
        .html(passFail(pf));

      // Col 9 (Overall Pill)
      const finalG = data[9];
      $('td:eq(9)', row)
        .attr('data-order', ORDER_MAP[finalG] ?? 99)
        .html(buildOverallPill(finalG));
    }
  });

  /* ---------- 4. Load Data & Filter Population ---------- */

  $.get(CSV_URL, csvContent => {
    const lines = csvContent.split(/\r?\n/);
    const states = new Set();

    // Start from index 1 to skip header row
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i].trim()) continue;
      
      const rowData = parseCSVLine(lines[i]);
      if (rowData.length < 10) continue;

      table.row.add(rowData);

      // Extract State for the filter dropdown from "D / DE"
      const parts = rowData[1].split('/');
      if (parts.length > 1) {
        states.add(parts[1].trim());
      }
    }
    table.draw();

    // Populate State Filter Dropdown
    Array.from(states).sort().forEach(s => {
      $('#state-filter').append(`<option value="${s}">${s}</option>`);
    });
  });

  /* ---------- 5. Filter Logic ---------- */

  // State Dropdown (Partial match, e.g., "DE" matches "D / DE")

  // Party Dropdown (Matches first character "D", "R", or "I")
  $('#party-filter').on('change', function () {
    const val = this.value ? '^' + this.value : '';
    table.column(1).search(val, true, false).draw();
  });

  // Grade Dropdown
  $('#grade-filter').on('change', function () {
    const val = this.value ? '^' + this.value : '';
    table.column(9).search(val, true, false).draw();
  });

  /* ---------- 6. Modal / Detail View ---------- */

  $('#scorecard-table tbody').on('click', 'tr', function () {
    const d = table.row(this).data();
    if (!d) return;

    $('.detail-name').text(d[0]);
    $('.detail-party-state').text(d[1]);
    
    $('.detail-pt').html(gradeCircle(d[2]));
    $('.detail-ca').html(passFail(d[3]));
    $('.detail-sj81').html(gradeCircle(d[4]));
    $('.detail-sj77').html(gradeCircle(d[5]));
    $('.detail-sj88').html(gradeCircle(d[6]));
    $('.detail-s232').html(gradeCircle(d[7]));
    $('.detail-messaging').html(gradeCircle(d[8]));
    
    $('.detail-overall').html(buildOverallPill(d[9]));
    $('.detail-explanation').text(d[10] || "");

    $('#detail-modal').addClass('open');
  });

  // Modal Closing
  $('.detail-close, #detail-modal').on('click', function (e) {
    if (e.target === this || $(e.target).hasClass('detail-close')) {
      $('#detail-modal').removeClass('open');
    }
  });

})();