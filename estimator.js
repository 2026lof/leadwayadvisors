// Illustrative US federal tax savings estimator. 2026 figures. Not tax advice.
(function () {
  var BRACKETS = {
    single: [[12400, 0.10], [50400, 0.12], [105700, 0.22], [201775, 0.24], [256225, 0.32], [640600, 0.35], [Infinity, 0.37]],
    married: [[24800, 0.10], [100800, 0.12], [211400, 0.22], [403550, 0.24], [512450, 0.32], [768700, 0.35], [Infinity, 0.37]]
  };
  var STD_DEDUCTION = { single: 16100, married: 32200 };
  var SS_WAGE_BASE = 184500;   // Social Security wage base
  var DEFERRAL_LIMIT = 24500;  // 401(k) employee deferral

  function incomeTax(taxable, status) {
    taxable = Math.max(0, taxable);
    var prev = 0, total = 0;
    BRACKETS[status].forEach(function (b) {
      if (taxable > prev) { total += (Math.min(taxable, b[0]) - prev) * b[1]; prev = b[0]; }
    });
    return total;
  }
  function marginalRate(taxable, status) {
    taxable = Math.max(0, taxable);
    var rows = BRACKETS[status];
    for (var i = 0; i < rows.length; i++) { if (taxable <= rows[i][0]) return rows[i][1]; }
    return 0.37;
  }
  // Income tax saved by an extra deduction on top of the standard deduction.
  function savedBy(income, deduction, status) {
    var taxable = income - STD_DEDUCTION[status];
    return incomeTax(taxable, status) - incomeTax(taxable - deduction, status);
  }
  function selfEmploymentTax(profit) {
    var base = profit * 0.9235;
    return 0.124 * Math.min(base, SS_WAGE_BASE) + 0.029 * base;
  }
  function payrollTax(salary) {
    return 0.124 * Math.min(salary, SS_WAGE_BASE) + 0.029 * salary;
  }

  var $ = function (id) { return document.getElementById(id); };
  var num = function (id) { var v = parseFloat($(id).value); return isFinite(v) && v > 0 ? v : 0; };
  var fmt = function (n) { return '$' + (Math.round(n / 100) * 100).toLocaleString('en-US'); };
  var range = function (lo, hi) {
    if (hi < 500) return '$0';
    return Math.round(lo / 100) === Math.round(hi / 100) ? fmt(hi) : fmt(lo) + ' – ' + fmt(hi);
  };

  function update() {
    var status = $('status').value;
    var income = num('income');
    var hasBiz = $('hasBiz').checked, hasRe = $('hasRe').checked, hasRet = $('hasRet').checked;
    $('bizFields').hidden = !hasBiz;
    $('reFields').hidden = !hasRe;

    var profit = hasBiz ? num('profit') : 0;
    var price = hasRe ? num('price') : 0;
    var rate = marginalRate(income - STD_DEDUCTION[status], status);

    // 1. S-corporation election: salary of 60% (low) or 40% (high) of profit.
    //    Reduced by the lost deduction for half of self-employment tax.
    var sLo = 0, sHi = 0;
    if (profit > 0) {
      var se = selfEmploymentTax(profit), keep = 1 - 0.5 * rate;
      sLo = Math.max(0, se - payrollTax(profit * 0.6)) * keep;
      sHi = Math.max(0, se - payrollTax(profit * 0.4)) * keep;
    }
    // 2. Cost segregation: 20-30% of the building (80% of price) deducted in year one.
    var cLo = price * 0.8 * 0.20 * 0.97, cHi = price * 0.8 * 0.30 * 0.97;
    // 3. Retirement plan deferral, limited to business profit.
    var ret = hasBiz && hasRet ? Math.min(DEFERRAL_LIMIT, profit) : 0;

    var rows = [];
    if (hasBiz) rows.push(['S-corporation election', 'Lower self-employment tax by paying yourself a reasonable salary', range(sLo, sHi)]);
    if (hasRe) rows.push(['Cost segregation study', 'First-year depreciation on a rental purchase, where the loss can be used', range(savedBy(income, cLo, status), savedBy(income, cHi, status))]);
    if (hasBiz && hasRet) rows.push(['Solo 401(k) deferral', 'Tax deferred on a ' + fmt(ret) + ' contribution', range(savedBy(income, ret, status), savedBy(income, ret, status))]);

    var totLo = sLo + savedBy(income, cLo + ret, status);
    var totHi = sHi + savedBy(income, cHi + ret, status);

    $('total').textContent = rows.length ? range(totLo, totHi) : '—';
    $('totalNote').textContent = rows.length
      ? 'Estimated first-year federal savings at a ' + Math.round(rate * 100) + '% marginal rate.'
      : 'Tick at least one option to see an estimate.';
    $('rows').innerHTML = rows.map(function (r) {
      return '<div class="result-row"><span>' + r[0] + '<small>' + r[1] + '</small></span><span>' + r[2] + '</span></div>';
    }).join('');
  }

  ['status', 'income', 'hasBiz', 'profit', 'hasRe', 'price', 'hasRet'].forEach(function (id) {
    $(id).addEventListener('input', update);
    $(id).addEventListener('change', update);
  });
  update();
})();
