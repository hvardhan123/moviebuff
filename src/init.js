// Import the functions you need from the SDKs you need
//import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js'
//import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore-lite.js'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, query, where, onSnapshot, getDoc, orderBy, limit, runTransaction } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_API_KEY,
  authDomain: process.env.REACT_APP_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_PROJECT_ID,
  storageBucket: process.env.REACT_APP_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_APP_ID
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth();
const usersCollection = collection(db, "users");

getDocs(usersCollection).then((snapshot) => {
  snapshot.forEach((doc) => {
    console.log(doc.id, doc.data());
  });
});

function createSignIn(email, password) {
  createUserWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed up 
    let user = userCredential.user.email;
    sessionStorage.setItem("userName", user);
    console.log("Created user ", user);
    return true;
    // ...
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    return false;
  });
}

function doAuth(email, password) {
  signInWithEmailAndPassword(auth, email, password)
  .then((userCredential) => {
    // Signed in 
    let userName = userCredential.user.email;
    sessionStorage.setItem("userName", userName);
    console.log("Logged in ", userName);
    window.location.href = "open.html";
    // ...
  })
  .catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    console.log("Invalid user ", errorMessage);
  });
}

async function setDocument(data) {
  let userName = sessionStorage.getItem("userName");
  console.log(userName);
  const cityRef = doc(db, 'users', userName);
  await setDoc(cityRef, data, { merge: true });
}

async function addMovie(data) {
  const movieRef = doc(db, 'movies', data.Name);
  const movieContainer = document.getElementById("movieDisplay");
  const movieDiv = document.createElement("div");

  try {
    await setDoc(movieRef, data, { merge: true });
    movieDiv.innerHTML = "Added movie " + data.Name
  } catch(e) {
    movieDiv.innerHTML = "Not authorized to add a movie"
  }
  movieContainer.appendChild(movieDiv);
}

async function addDocument(data) {
  try {
    const docRef = await addDoc(collection(db, "users"), data);
    console.log("Document written with ID: ", docRef.id);
  } catch (e) {
    console.error("Error adding document: ", e);
  }
}

async function fetchUserDetails() {
  let userName = sessionStorage.getItem("userName");
  const docRef = doc(db, "users", userName);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    return {"Location" : docSnap.data().Location, "Genre": docSnap.data().Genre}; 
  } else {
    // docSnap.data() will be undefined in this case
    console.log("No such user!");
    return {};
  }
}

function updateUIRankedMovies(rankedMovies) {
  const movieContainer = document.getElementById("movie-container");
  movieContainer.innerHTML = "";
  if (!rankedMovies.length) {
    movieContainer.innerHTML = "<p>No movies found.</p>";
    return;
  }

  rankedMovies.forEach((movie) => {
    let locations = []
    const movieDiv = document.createElement("div");
    movieDiv.className = "movie";
    const myMap = new Map(Object.entries(movie.Location));
    for (let [key, value] of  myMap) {
      if (value == "True") {
        locations.push(key);
      }
    }
    movieDiv.innerHTML = `
      <h2><a href="addreview.html?movieId=${movie.Name}">${movie.Name}</a></h2>
      <p><strong>Year: </strong> ${movie.Year}</p>
      <p><strong>Location: </strong> ${locations}</p>
      <p><strong>Genre: </strong> ${movie.Genre}</p>
      <p><strong>Rating: </strong>${movie.Rating}</p>
      <p><strong>RatingCount: </strong>${movie.RatingCount}</p>
      `;
    movieContainer.appendChild(movieDiv);
  });
}

async function getMovies() {
  const movieContainer = document.getElementById("movie-container");
  let userDetails = await fetchUserDetails();
  if (!userDetails) {
    console.log("Unable to fetch user details");
    return;
  }

  let q = query(collection(db, "movies"), where("Genre", "array-contains-any", userDetails.Genre));
  q = query(q, where("Location." + userDetails.Location, "==", "True"));
  q = query(q, orderBy("Rating", "desc"));
  q = query(q, limit(10));

  // Attach a real-time listener
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const rankedMovies = [];
      querySnapshot.forEach((doc) => {
        const movie = doc.data();
        const score = userDetails.Genre.filter((genre) => movie.Genre.includes(genre)).length;
        rankedMovies.push({id: doc.id, ...movie, score});
      });
      rankedMovies.sort((a, b) => b.score - a.score);
      updateUIRankedMovies(rankedMovies);
    },
    (error) => {
      console.error("Error retrieving query results:", error);
      movieContainer.innerHTML = `<p class="error">Error loading movies: ${error.message}</p>`;
    }
  );
}

async function getMovieById(movieId) {
  // Reference to the movie document
  const movieRef = doc(db, "movies", movieId);
  
  try {
    // Fetch the document snapshot
    const docSnap = await getDoc(movieRef);
    
    if (docSnap.exists()) {
      // If the document exists, get the data
      const movieData = docSnap.data();
      return movieData;
    } else {
      return null;
    }
  } catch (error) {
    console.error("Error getting movie:", error);
    return null;
  }
}

async function addReview(movieId, review, rating) {
  const movieRef = doc(db, 'movies', movieId);
  let userName = sessionStorage.getItem("userName");
  const ratingsRef = doc(db, "movies", movieId, "ratings", userName);
  await runTransaction(db, async (transaction) => {
    const movieDoc = await transaction.get(movieRef);
    const movieData = movieDoc.data(); // Ensure this is accessed after the promise resolves
    // Data to store
    const ratingData = {
      Rating: rating, // Store as a number
      Review: review, // Store as a string
      Timestamp: new Date(), // Add a timestamp
    };
    transaction.set(ratingsRef, ratingData);
    // Update the movie document with the new rating and rating count
    let overallRating = parseFloat(((movieData.Rating * movieData.RatingCount + rating) / (movieData.RatingCount + 1)).toFixed(2));
    transaction.update(movieRef, {
      Rating: overallRating,
      RatingCount: movieData.RatingCount + 1,
    });
  });
}

    // Fetch reviews for a movie
    async function fetchReviews(movieId) {
      try {
        const reviewsList = document.getElementById("reviews-list");
        reviewsList.innerHTML = ""; // Clear previous reviews

        const reviewsRef = collection(db, "movies", movieId, "ratings");
        const querySnapshot = await getDocs(reviewsRef);

        querySnapshot.forEach((doc) => {
          const review = doc.data();
          const reviewDiv = document.createElement("div");
          reviewDiv.className = "review";

          reviewDiv.innerHTML = `
            <p class="review-user">User ID:${doc.id}</p>
            <p class="review-comment">Rating:${review.Rating}</p>
            <p class="review-rating">${review.Review}</p>
          `;
          reviewsList.appendChild(reviewDiv);
        });

        if (querySnapshot.empty) {
          reviewsList.innerHTML = "<p>No reviews yet.</p>";
        }
      } catch (error) {
        console.error("Error fetching reviews:", error);
      }
    }


window.addDocument = addDocument;
window.doAuth = doAuth;
window.createSignIn = createSignIn;
window.setDocument = setDocument;
window.getMovies = getMovies;
window.addMovie = addMovie;
window.fetchUserDetails = fetchUserDetails;
window.getMovieById = getMovieById;
window.addReview = addReview;
window.fetchReviews = fetchReviews;