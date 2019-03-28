// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { userInfo } from "os";
const randomWords = require("random-words");
import * as _bonjour from "bonjour";
const bonjour = _bonjour();

const userName = userInfo().username;
const serviceName = "liveShare";

const publishTimeout = 15; // in seconds
const discoveryTimeout = 5; // in seconds

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  // Use the console to output diagnostic information (console.log) and errors (console.error)
  // This line of code will only be executed once when your extension is activated
  console.log(
    'Congratulations, your extension "vs-live-share-mdns" is now active!'
  );

  // The command has been defined in the package.json file
  // Now provide the implementation of the command with registerCommand
  // The commandId parameter must match the command field in package.json
  let disposable = vscode.commands.registerCommand(
    "extension.liveShareMdns.start",
    async () => {
      // The code you place here will be executed every time your command is executed
      await vscode.commands.executeCommand("liveshare.start");
      const liveShareLink = await vscode.env.clipboard.readText();
      const password = randomWords();

      const ad = bonjour.publish({
        name: userName,
        type: serviceName,
        port: 8000,
        txt: {
          password: password,
          l: liveShareLink.split("?")[1]
        }
      });

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
                // TODO!
                ad.stop(() => true);
                vscode.window.showErrorMessage("Stopped publishing");
              }
            }, 1000);
          });
        }
      );

      // Display a message box to the user
      vscode.window.showInformationMessage(
        `Live Share Mdns: session password is "${password}"`
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
      if (selected) {
        let link = selected.service.txt["l"];
        link = `https://insiders.liveshare.vsengsaas.visualstudio.com/join?${link}`;
        vscode.commands.executeCommand("liveshare.openLink", link);
      }
    }
  );

  context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {}
