// Usados por mais de um módulo (clientes, casos e, na parte B, documentos). Um token só
// evita dois símbolos homônimos apontando para o mesmo service.
export const DOCUMENTO_SERVICE = Symbol("DOCUMENTO_SERVICE");
export const ZIP_DOCUMENTOS = Symbol("ZIP_DOCUMENTOS");
