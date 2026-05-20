document.addEventListener('DOMContentLoaded', () => {
    // Connects JavaScript variables to HTML elements by ID
    const btn = document.getElementById('fetchBtn');
    const clearBtn = document.getElementById('clearBtn');
    const input = document.getElementById('userInput');
    const display = document.getElementById('display');
    const historyPanel = document.getElementById('historyPanel');
    const showFavsBtn = document.getElementById('showFavsBtn');
    const status = document.getElementById('status');


    // Fetches search history from LocalStorage or starts with empty []
    let history = JSON.parse(localStorage.getItem('searchHistory')) || [];

    // Fetches favorites from LocalStorage or starts with empty []
    let favorites = JSON.parse(localStorage.getItem('favShows')) || [];
    
    // Cache for search results so we don't have to fetch twice unnecessarily
    let currentResults = [];

    // Boolean flag to keep track of our current display mode
    let isShowingFavs = false;

    // Checks if Dark Mode was saved previously and applies the class
    if (localStorage.getItem('dark-mode') === 'enabled') document.body.classList.add('dark');

    // Runs initial function to build the history button UI
    renderHistory();

    // Event listener to toggle theme and save preference
    document.getElementById('themeToggle').addEventListener('click', () => {
        document.body.classList.toggle('dark');
        localStorage.setItem('dark-mode', document.body.classList.contains('dark') ? 'enabled' : 'disabled');
    });
    
    // Clears the screen and resets search memory
    clearBtn.addEventListener('click', () => {
        display.innerHTML = ""; input.value = ""; status.textContent = "Ready.";
        currentResults = []; isShowingFavs = false;
    });

    // The main AJAX function to get the data from TVMaze
    const performSearch = async (query) => {
        // Guard clause - stops function if search box is empty
        if (!query) return;
        // Switch to 'Search Mode' if we were looking at favorites
        isShowingFavs = false;
        try {
            // Display 'Ghost' cards while waitign for the server
            showSkeletons();
            status.textContent = "Fetching show data...";

            // The AJAX call - 'await' pauses cod euntil data arrives
            const res = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`);
            //Converts the server's raw JSON into a JavaScript object
            const data = await res.json();
            // Saves results to current memory for view switching
            currentResults = data;
            if (data.length > 0) {
                // update history list with the new successful search
                updateHistory(query);
                // Injects the show cards into the main display grid
                renderResults(data);
            } else {
                status.textContent = "No shows found."; display.innerHTML = "";
            }
        } catch (err) { status.textContent = "Network Error. Try again."; }
    };
    
    // Event Listener for the search button click
    btn.addEventListener('click', () => performSearch(input.value.trim()));

    // Manages history array and saves it to LocalStorage
    function updateHistory(term) {
        history = [term, ...history.filter(h => h !== term)].slice(0, 5);
        localStorage.setItem('searchHistory', JSON.stringify(history));
        renderHistory();
    }

    // Creates the HTML for history "pill" buttons
    function renderHistory() {
        if (history.length === 0) return;
        historyPanel.innerHTML = history.map(t =>
            `<button class="hist-pill" onclick="historyClick('${t}')">${t}</button>`
        ).join('');
    }

    // Attached to window so inline HTML onclick can find it
    window.historyClick = (t) => { input.value = t; performSearch(t); };

    // TOGGLE VIEW LOGIC (The Fix for Favorites Data)
    showFavsBtn.addEventListener('click', () => {
        isShowingFavs = !isShowingFavs;
        if (isShowingFavs) {
            // FIX -Wrap favorites in a {show: x}objecy so renderResults works
            renderResults(favorites.map(f => ({ show: f})));
        } else {
            // Go back to the results we cached from the last search
            renderResults(currentResults);
        }
    });


    // The UI Rendering "Engine"
    function renderResults(data) {
        // Dynamic heading update
        status.textContent = isShowingFavs
            ? `Saved Favorites (${data.length})`
            : `Matches (${data.length})`;

        // Loops through array to build the card HTML string
        display.innerHTML = data.map(item => {
            const s = item.show; // Extracts the show object
            
            // ⭐ rating
            const rating = s.rating?.average || "N/A";
            // Clean summary
            const cleanSummary = s.summary 
                ? s.summary.replace(/<[^>]*>/g, '') 
                : "No description available.";
            // Short preview
            const shortSummary = cleanSummary.length > 200
                ? cleanSummary.slice(0, 200) + "..."
                : cleanSummary;

            // Show 'More' button only if needed
            const hasMore = cleanSummary.length > 200;

            // Checks if this show ID is currently in the favorites
            const isFav = favorites.some(fav => fav.id === s.id);

            return `
                <div class="card">
                    <img src="${s.image ? s.image.medium : 'https://via.placeholder.com/210x295'}">
                    
                    <div class="card-body">
                        <h3>${s.name}</h3>
                        <p><strong>⭐ </strong>${rating}</p>
                        <p>${shortSummary}</p>

                        <div class="bottom-row">
                            ${hasMore 
                                ? `<button class="more-btn" data-summary="${cleanSummary.replace(/"/g, '&quot;')}">
                                More
                                </button>` 
                                : ``
                            }
                            
                            <button class="fav-btn ${isFav ? 'active' : ''}" data-id="${s.id}">
                                ${isFav ? '❤️' : '🤍'}
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }).join(''); // Combines the array into one HTML  ------- <button class="fav-btn ${isFav ? 'active' : ''}" onclick="toggleFav(${s.id})">

        // event listener for More buttonS
        document.querySelectorAll('.more-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-summary');
                openModal(text);
            });
        });

        document.querySelectorAll('.fav-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                toggleFav(id);
            });
        });
    }

    // Shows show summary if it is long
    window.openModal = (text) =>{
        /*const decoded = decodeURIComponent(text)*/
        document.getElementById("modalText").textContent = text; /*decoded;*/
        document.getElementById("modal").style.display = "flex";
    };

    window.closeModal = () => {
        document.getElementById("modal").style.display = "none";
    };

    // Toggles shows in and out of the Favorites array
    window.toggleFav = (id) => {
        const index = favorites.findIndex(f => f.id === id);
        if(index > -1) {
            favorites.splice(index, 1); // Remove if found
        } else {
            const found = currentResults.find(r => r.show.id === id);
            if(found) favorites.push(found.show); // Add show object if not found
        }
        localStorage.setItem('favShows', JSON.stringify(favorites));
        // Refresh the current screen mode immediately
        isShowingFavs ? renderResults(favorites.map(f => ({ show: f }))) :  renderResults(currentResults);
    };

    // Generates skeleton cards for visual loading feedback
    function showSkeletons() {
        display.innerHTML = Array(4).fill('<div class="card skeleton"><div class="skel-img"></div></div>').join('');
    }
});