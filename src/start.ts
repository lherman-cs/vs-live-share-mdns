import vscode from "vscode";
const randomWords = require("random-words");
import CryptoJS from "crypto-js";
import _bonjour from "bonjour";
const bonjour = _bonjour();

import { userName, serviceName, publishTimeout } from "./const";
import { Session } from "./interface";

function publish(link: string, password: string) {
  const liveShareCode = link.split("?")[1];
  const hashedPassword = CryptoJS.SHA256(password).toString();
  const encryptedLink = CryptoJS.AES.encrypt(
    liveShareCode,
    password
  ).toString();

  const session = <Session>{
    p: hashedPassword,
    l: encryptedLink
  };

  return bonjour.publish({
    name: userName,
    type: serviceName,
    port: 8000,
    txt: session
  });
}

export default async function () {
  await vscode.commands.executeCommand("liveshare.start");
  const liveShareLink = await vscode.env.clipboard.readText();
  const password = randomWords();
  const ad = publish(liveShareLink, password);

  await vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `The password is "${password}". Waiting for your teammate(s)...`,
      cancellable: true
    },

    async (progress, token) => {
      token.onCancellationRequested(() => {
        // TODO!
        ad.stop(() => true);
      });

      const step = 100 / publishTimeout;
      let elapsed = 0;
      progress.report({ increment: 0 });
      await new Promise((resolve, _) => {
        const interval = setInterval(() => {
          elapsed++;
          progress.report({ increment: step });

          if (elapsed === publishTimeout) {
            clearInterval(interval);
            // TODO!
            ad.stop(() => true);
            vscode.window.showErrorMessage("Stopped publishing");
            resolve();
          }
        }, 1000);
      });
    }
  );
}
