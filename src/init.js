// Import the functions you need from the SDKs you need
//import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-app.js'
//import { getFirestore, collection, getDocs } from 'https://www.gstatic.com/firebasejs/11.1.0/firebase-firestore-lite.js'
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, addDoc, doc, setDoc, query, where, onSnapshot, getDoc, orderBy, limit } from 'firebase/firestore';
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

async function getMovies() {
  const movieContainer = document.getElementById("movie-container");
  let getDetails = await fetchUserDetails();
  if (!getDetails) {
    console.log("Unable to fetch user details");
    return;
  }

  let q = query(collection(db, "movies"), where("Location", "array-contains", getDetails.Location));
  for (let g = 0; g < getDetails.Genre.length; g++) {
    q = query(q, where("Genre." + getDetails.Genre[g], "==", "True"));
  }
  q = query(q, orderBy("Rating", "desc"));
  q = limit(10);
  // Attach a real-time listener
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      movieContainer.innerHTML = "";
      if (querySnapshot.empty) {
        movieContainer.innerHTML = "<p>No movies found.</p>";
        return;
      }
      querySnapshot.forEach((doc) => {
        const movie = doc.data();
        const movieDiv = document.createElement("div");
        movieDiv.className = "movie";
        let genres = []
        const myMap = new Map(Object.entries(movie.Genre));
        for (let [key, value] of  myMap) {
          if (value == "True") {
            genres.push(key);
          }
        }
        movieDiv.innerHTML = `
          <h2>${movie.Name}</h2>
          <p><strong>Year:</strong> ${movie.Year}</p>
          <p><strong>Location:</strong> ${movie.Location}</p>
          <p><strong>Genre:</strong> ${genres}</p>
          <p><strong>Rating:</strong>${movie.Rating}</p>
        `;
        movieContainer.appendChild(movieDiv);
      });
    },
    (error) => {
      console.error("Error retrieving query results:", error);
      movieContainer.innerHTML = `<p class="error">Error loading movies: ${error.message}</p>`;
    }
  );
}

window.addDocument = addDocument;
window.doAuth = doAuth;
window.createSignIn = createSignIn;
window.setDocument = setDocument;
window.getMovies = getMovies;
window.addMovie = addMovie;
window.fetchUserDetails = fetchUserDetails;