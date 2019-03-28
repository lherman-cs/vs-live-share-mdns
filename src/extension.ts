// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { userInfo } from "os";
import * as CryptoJS from "crypto-js";
const randomWords = require("random-words");
import * as _bonjour from "bonjour";
const bonjour = _bonjour();

const userName = userInfo().username;
const serviceName = "liveShare";

const publishTimeout = 15; // in seconds
const discoveryTimeout = 5; // in seconds

export function activate(context: vscode.ExtensionContext) {
  let disposable = vscode.commands.registerCommand(
    "extension.liveShareMdns.start",
    async () => {
      await vscode.commands.executeCommand("liveshare.start");
      const liveShareLink = await vscode.env.clipboard.readText();
      const liveShareCode = liveShareLink.split("?")[1];
      const password = randomWords();
      const hashedPassword = CryptoJS.SHA256(password).toString();
      const encryptedLink = CryptoJS.AES.encrypt(
        liveShareCode,
        password
      ).toString();

      const ad = bonjour.publish({
        name: userName,
        type: serviceName,
        port: 8000,
        txt: {
          p: hashedPassword,
          l: encryptedLink
        }
      });

      // Display a message box to the user
      vscode.window.showInformationMessage(
        `Live Share Mdns: session password is "${password}"`
      );

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Waiting for your teammate",
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
  );

  context.subscriptions.push(disposable);

  /** Discover */
  disposable = vscode.commands.registerCommand(
    "extension.liveShareMdns.discover",
    async () => {
      type item = {
        label: string;
        service: _bonjour.Service;
      };
      const services: item[] = [];

      const browser = bonjour.find({ type: serviceName }, function(service) {
        services.push({
          label: service.name,
          service
        });
      });

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Discovering your teammate 💪",
          cancellable: true
        },
        async (progress, token) => {
          token.onCancellationRequested(() => {
            browser.stop();
          });

          const step = 100 / discoveryTimeout;
          let elapsed = 0;
          progress.report({ increment: elapsed });

          await new Promise((resolve, _) => {
            const interval = setInterval(() => {
              elapsed++;
              progress.report({
                increment: step,
                message: `discovered ${services.length} peers`
              });
              if (elapsed === discoveryTimeout) {
                browser.stop();
                clearInterval(interval);
                resolve();
              }
            }, 1000);
          });
        }
      );

      if (services.length === 0) {
        vscode.window.showErrorMessage("There's no peer found");
        return;
      }

      const selected = await vscode.window.showQuickPick<item>(services);
      if (!selected) {
        return;
      }

      const askPassword = async (): Promise<string | undefined> => {
        const password = await vscode.window.showInputBox({
          ignoreFocusOut: true,
          password: true,
          placeHolder: "Please input the session's password here"
        });
        if (!password) {
          return;
        }

        const hashedPassword = selected.service.txt["p"];
        const match = CryptoJS.SHA256(password).toString() === hashedPassword;
        if (!match) {
          vscode.window.showErrorMessage("wrong password, please try again");
          return await askPassword();
        }
        return password;
      };

      const password = await askPassword();
      if (!password) {
        return;
      }

      const encryptedCode = selected.service.txt["l"];
      const code = CryptoJS.AES.decrypt(encryptedCode, password).toString(
        CryptoJS.enc.Utf8
      );
      const link = `https://insiders.liveshare.vsengsaas.visualstudio.com/join?${code}`;
      vscode.commands.executeCommand("liveshare.openLink", link);
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
