import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// async function listPrimitives(client) {
//     const capabilities = client.getServerCapabilities();
//     console.log(`Capabilities: ${JSON.stringify(capabilities)}`);

//     if (capabilities.tools) {
//         console.log("Tools are available");
//         client.listTools().then(({ tools }) => {
//             tools.forEach((tool) => {
//                 console.log(`- ${tool.name}: ${tool.description || "No description"}`);
//                 console.log(`  Input Schema:`, tool.inputSchema);
//             });
//         });
//     }

//     const primitives = [];
//     // const promises = [];
//     // if (capabilities.resources) {
//     // promises.push(
//     //     client.listResources().then(({ resources }) => {
//     //     resources.forEach((item) => primitives.push({ type: "resource", value: item }));
//     //     })
//     // );
//     // }
//     // if (capabilities.tools) {
//     // promises.push(
//     //     client.listTools().then(({ tools }) => {
//     //     tools.forEach((item) => primitives.push({ type: "tool", value: item }));
//     //     })
//     // );
//     // }
//     // if (capabilities.prompts) {
//     // promises.push(
//     //     client.listPrompts().then(({ prompts }) => {
//     //     prompts.forEach((item) => primitives.push({ type: "prompt", value: item }));
//     //     })
//     // );
//     // }
//     // await Promise.all(promises);

//     // console.log(`Capabilities: ${primitives}`);
//     return primitives;
// }

// async function connectServer(transport) {
//   const client = await new Client({ name: "mcp-cli", version: "1.0.0" }, { capabilities: {} });
//   await client.connect(transport);
//   const primitives = await listPrimitives(client);
// //   console.log("Primitive list:");
// //   primitives.forEach((primitive) => {
// //     console.log(`- ${primitive.type}: ${primitive.value.name} (${primitive.value.description})`);
// //   }
// //   );

//     // const serverCapabilities = await client.getServerCapabilities();
//     // console.log(`Capabilities: ${JSON.stringify(serverCapabilities)}`);
// }

// export async function runWithCommand(command, args) {
//   const transport = new StdioClientTransport({ command, args });
//   await connectServer(transport);
// }

// async function main() {
//     const command = "npx";
//     const args = ["-y", "@jeromyfu/app-insight-mcp"];
//     await runWithCommand(command, args);
// };

async function main() {
  // 1. Configure the Transport
  const transport = new StdioClientTransport({
    command: "npx",
    args: ["-y", "@jeromyfu/app-insight-mcp"],
  });

  // 2. Create the Client
  const client = await new Client({ name: "mcp-cli", version: "1.0.0" }, { capabilities: {} });

  try {
    // 3. Connect to the Server
    console.log("Connecting to the MCP server...");
    await client.connect(transport);
    console.log("Connected to the MCP server!");

    const capabilities = await client.getServerCapabilities();
    console.log(`Capabilities: ${JSON.stringify(capabilities)}`);

    // // 6. List Available Tools
    console.log("\nListing available tools:");
    const tools = await client.listTools();
    console.log(tools);
    // if (tools.tools.length > 0) {
    //   tools.tools.forEach((tool) => {
    //     console.log(`- ${tool.name}: ${tool.description || "No description"}`);
    //     console.log(`  Input Schema:`, tool.inputSchema);
    //   });
    // } else {
    //   console.log("No tools found.");
    // }


  //   if (capabilities.tools) {
  //     console.log("Tools are available");
  //     await client.listTools().then(({ tools }) => {
  //         tools.forEach((tool) => {
  //             console.log(`- ${tool.name}: ${tool.description || "No description"}`);
  //             console.log(`  Input Schema:`, tool.inputSchema);
  //         });
  //     });
  // }

    // // 7. Example: Call a Tool (if available)
    // if (tools.length > 0) {
    //   const firstTool = tools[0];
    //   console.log(`\nCalling tool: ${firstTool.name}`);
    //   try {
    //     const result = await client.callTool({
    //       name: firstTool.name,
    //       arguments: {}, // You might need to provide arguments based on the tool's inputSchema
    //     });
    //     console.log("Tool call result:", result);
    //   } catch (toolError) {
    //     console.error("Error calling tool:", toolError);
    //   }
    // }
  } catch (connectionError) {
    console.error("Error connecting to or interacting with the MCP server:", connectionError);
  } finally {
    // 10. Close the connection
    await client.close();
    console.log("\nDisconnected from the MCP server.");
  }
}

main().catch((error) => {
  console.error("An unhandled error occurred:", error);
  process.exit(1);
});


// import { Client } from "@modelcontextprotocol/sdk/client/index.js";
// import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

// async function createClient() {
//   const client = new Client({ name: "mcp-cli", version: "1.0.0" }, { capabilities: {} });
//   return client;
// }

// async function listPrimitives(client) {
//   const capabilities = client.getServerCapabilities();
//   const primitives = [];
//   const promises = [];
//   if (capabilities.resources) {
//     promises.push(
//       client.listResources().then(({ resources }) => {
//         resources.forEach((item) => primitives.push({ type: "resource", value: item }));
//       })
//     );
//   }
//   if (capabilities.tools) {
//     promises.push(
//       client.listTools().then(({ tools }) => {
//         tools.forEach((item) => primitives.push({ type: "tool", value: item }));
//       })
//     );
//   }
//   if (capabilities.prompts) {
//     promises.push(
//       client.listPrompts().then(({ prompts }) => {
//         prompts.forEach((item) => primitives.push({ type: "prompt", value: item }));
//       })
//     );
//   }
//   await Promise.all(promises);
//   return primitives;
// }

// async function connectServer(transport) {
//   const client = await createClient();
//   await client.connect(transport);
//   const primitives = await listPrimitives(client);
//   console.log("Primitive list:");
//   primitives.forEach((primitive) => {
//     console.log(`- ${primitive.type}: ${primitive.value.name} (${primitive.value.description})`);
//   }
//   );
// }

// export async function runWithCommand(command, args) {
//   const transport = new StdioClientTransport({ command, args });
//   await connectServer(transport);
// }

// async function main() {
//     const command = "npx";
//     const args = ["-y", "@jeromyfu/app-insight-mcp"];
//     await runWithCommand(command, args);
// };

// main().catch((error) => {
//   console.error("An unhandled error occurred:", error);
//   process.exit(1);
// });