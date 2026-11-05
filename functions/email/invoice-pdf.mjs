import {renderInvoicePdf as legacy} from './invoice-pdf-legacy.mjs';
import {renderApprovedInvoicePdf} from './invoice-pdf-approved.mjs';
export function renderInvoicePdf(invoice,{designVersion=invoice.documentDesignVersion||invoice.documentTemplateVersion||'legacy'}={}){
 if(designVersion==='legacy')return legacy(invoice);
 if(designVersion!=='pdf-v4')throw Error('UNKNOWN_DOCUMENT_TEMPLATE');
 return renderApprovedInvoicePdf(invoice);
}
