import {renderPaymentDocumentPdf} from './payment-pdf.mjs';
import {renderInvoicePdf as legacy} from './invoice-pdf-legacy.mjs';
import {renderApprovedInvoicePdf} from './invoice-pdf-approved.mjs';
export function renderInvoicePdf(invoice,{designVersion=invoice.documentDesignVersion||invoice.documentTemplateVersion||'legacy'}={}){
 if(['pdf-v4-financial','pdf-v4-loyalty'].includes(designVersion))return renderPaymentDocumentPdf(invoice);
 if(designVersion==='legacy')return legacy(invoice);
 if(designVersion!=='pdf-v4')throw Error('UNKNOWN_DOCUMENT_TEMPLATE');
 return renderApprovedInvoicePdf(invoice);
}
