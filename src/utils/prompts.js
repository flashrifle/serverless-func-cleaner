import inquirer from "inquirer";

export async function confirmAction(message) {
  const { confirmed } = await inquirer.prompt([
    {
      type: "confirm",
      name: "confirmed",
      message: message,
      default: false,
    },
  ]);

  return confirmed;
}
