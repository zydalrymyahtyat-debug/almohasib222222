import fs from 'fs';

let rules = fs.readFileSync('firestore.rules', 'utf8');

const newRules = rules.replace(
  '    match /inventory_movements/{docId} {',
  `    match /pos_invoices/{docId} {
      allow read, update, delete: if (request.auth != null && resource.data.userId == request.auth.uid) || isAdmin();
      allow create: if (request.auth != null && request.resource.data.userId == request.auth.uid) || isAdmin();
    }
    
    match /inventory_movements/{docId} {`
);

fs.writeFileSync('firestore.rules', newRules);
console.log("Added pos_invoices to firestore.rules");
