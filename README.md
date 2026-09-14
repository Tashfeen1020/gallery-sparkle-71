# Photo Haven

Create an HTML file for a photo gallery web app. It should have an upload form with inputs for: Uploader Name, Photo file select, and a 4-digit Secret PIN. Below the upload section, create a responsive gallery grid to display the uploaded photos. Add modern, clean, and mobile-responsive CSS styles to this photo gallery layout. How can I integrate Firebase Storage and Firestore in this HTML page so users can upload photos without signing in, and anyone can view them from any device? Provide the JS configuration and setup code. Write JavaScript functions to handle the photo upload process. Save the image in Firebase Storage, and store the photo URL, uploader name, and PIN in Firestore database. Then fetch and render all photos in the gallery dynamically. Add a Delete button to each photo in the gallery grid. When clicked, ask the user to input the 4-digit PIN. If the PIN matches the PIN saved in Firestore, delete the photo from both Firebase Storage and Firestore.And the delete button must be working and the photo must be deleted without error. Give a toogle button for favourite photos and give a colorful search bar for searcing photoes

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://gallery-sparkle-71.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/7865b715-68bd-428d-9fae-2940db97f09f).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
