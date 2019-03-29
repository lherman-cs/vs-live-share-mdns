import vscode, { CancellationTokenSource } from "vscode";
import CryptoJS from "crypto-js";
import _bonjour from "bonjour";
const bonjour = _bonjour();

import { serviceName, discoveryTimeout } from "./const";

type item = {
  label: string;
  service: _bonjour.Service;
};

async function find(token: vscode.CancellationToken): Promise<item[]> {
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
      title: "Discovered",
      cancellable: true
    },
    (progress, token) => {
      const step = 100 / discoveryTimeout;
      const nobodyMsg = "nobody 😢";
      progress.report({
        increment: 0,
        message: nobodyMsg
      });

      return new Promise(resolve => {
        let elapsed = 0;
        const interval = setInterval(() => {
          elapsed++;
          const names = services.map(s => s.label).join(", ");
          const message = names || nobodyMsg;
          progress.report({
            increment: step,
            message: message
          });

          if (elapsed === discoveryTimeout) {
            clearInterval(interval);
            resolve();
          }
        }, 1000);

        token.onCancellationRequested(() => {
          clearInterval(interval);
          resolve();
        });
      });
    }
  );

  browser.stop();
  return services;
}

export default async function() {
  const tokenSrc = new CancellationTokenSource();
  const services = await find(tokenSrc.token);

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
