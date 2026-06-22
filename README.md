# positivity-board

A warm Korean positivity board where signed-in users can write posts, leave comments, and use an OpenAI-powered robot to soften messages before publishing.

## Deploy front end with GitHub Pages

This repository is a static site at the repository root. GitHub Pages deploys it with `.github/workflows/pages.yml` whenever `main` is pushed.

In GitHub:

1. Open `Settings` > `Pages`.
2. Set `Build and deployment` > `Source` to `GitHub Actions`.
3. Push to `main`.

The front end still uses Firebase for Auth, Firestore, and Cloud Functions. Add your GitHub Pages domain to Firebase Authentication authorized domains, for example:

```text
kangikgyu.github.io
```

If Firestore rules changed, deploy them separately:

```bash
firebase deploy --only firestore:rules --project positivity-board-ig
```

## OpenAI secret setup

Do not commit your OpenAI API key to this repository. The Cloud Function reads a Firebase Secret named `OPENAI_API_KEY`.

If you have already created the secret in Google Cloud Secret Manager, make sure the secret name is exactly:

```text
OPENAI_API_KEY
```

If you prefer the Firebase CLI, you can create or update the same secret with:

```bash
firebase functions:secrets:set OPENAI_API_KEY --project positivity-board-ig
```

Enter the real OpenAI API key only when the CLI prompts for the secret value.

## Deploy functions

Install function dependencies and deploy the callable function:

```bash
cd functions
npm install
cd ..
firebase deploy --only functions --project positivity-board-ig
```

The front end calls the `polishText` callable function from `robot-polisher.js`; the API key is never sent to the browser.
