/*SG-AUDIT:finance-28.js*/(function(root){'use strict';
// Audit and Dispute exports share the same reconciled claim records.
function build(report){return root.UPSReviewReports.disputeData(report);}
root.UPSDisputeExport={build};
})(typeof window==='undefined'?globalThis:window);
