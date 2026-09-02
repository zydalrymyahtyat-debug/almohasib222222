1. **Add a state variable for search term in `StatementView.tsx`**. I need to add `const [searchTerm, setSearchTerm] = useState("");` to track the search query in the StatementView.
2. **Add the Search Bar UI in `StatementView.tsx`**. I will add a search input with an icon just below the "سجل العمليات المالية" heading (or replacing it / next to it) so the user can easily filter transactions. I'll style it similarly to the one in MarketMqawetView.
3. **Filter transactions based on search term**. Create a filtered list of transactions before mapping them in the UI:
   - Search by transaction note/description (`t.note`).
   - Search by amount (`t.amount`).
   - Search by date (`dateText`).
4. **Complete pre commit steps**
   - Ensure the code complies with all formatting, linting and testing requirements.
5. **Submit changes**
   - Once verified, I will commit and push the changes for the new search feature.
