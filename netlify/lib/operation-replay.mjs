// Shared decision used inside the company transaction, before any mutation.
export function replayOperationReceipt(receipt,operation,actor,fail){
 if(!receipt)return null;
 if(receipt.actor!==actor||receipt.payloadHash!==operation.hash)fail('Identificador de guardado reutilizado con otros datos.',422);
 return {revision:receipt.revision,replayed:true,resultId:receipt.resultId};
}
