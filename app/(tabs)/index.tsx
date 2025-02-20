import {
  Image,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Linking,
  Clipboard,
} from "react-native";
import React, { useEffect, useState } from "react";
import { BackupMethods, Portal } from "@portal-hq/core";
import { PasswordStorage } from "@portal-hq/utils/src/definitions";
import Toast from "react-native-toast-message";

import ParallaxScrollView from "@/components/ParallaxScrollView";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";
import {
  ALCHEMY_API_KEY,
  RECIPIENT_ADDRESS,
  SEPOLIA_CHAIN_ID,
  USDC_AMOUNT_TO_SEND,
} from "@/config";

export default function WalletScreen() {
  // State management
  const [clientApiKey, setClientApiKey] = useState<string>("");
  const [walletAddress, setWalletAddress] = useState<string>("");
  const [isWalletCreating, setIsWalletCreating] = useState(false);
  const [recipientAddress, setRecipientAddress] =
    useState<string>(RECIPIENT_ADDRESS);
  const [transactionHash, setTransactionHash] = useState<string>("");
  const [portalInstance, setPortalInstance] = useState<Portal | null>(null);
  const [isTransferring, setIsTransferring] = useState<boolean>(false);

  // Initialize Portal instance with API key and backup methods
  const handleInitializePortal = () => {
    if (!clientApiKey) throw new Error("Client API Key is required");
    if (!ALCHEMY_API_KEY) throw new Error("Alchemy API Key is required");

    const backupOptions = {
      [BackupMethods.Password]: new PasswordStorage(),
    };

    setPortalInstance(
      new Portal({
        autoApprove: true,
        apiKey: clientApiKey,
        backup: backupOptions,
        gatewayConfig: {
          [SEPOLIA_CHAIN_ID]: `https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
        },
      })
    );
  };

  useEffect(() => {
    const checkExistingWallet = async () => {
      try {
        const addresses = await portalInstance?.addresses;
        const eip155Address = addresses?.eip155;

        if (eip155Address) {
          setWalletAddress(eip155Address);
          console.log("✅ Existing wallet found:", eip155Address);
        }
      } catch (error) {
        console.error("Error checking existing wallet:", error);
      }
    };

    if (portalInstance) {
      checkExistingWallet();
    }
  }, [portalInstance]);

  const handleWalletSetup = async () => {
    setIsWalletCreating(true);

    // Create wallet
    try {
      console.log("Creating wallet...");
      const addresses = await portalInstance?.createWallet((status) => {
        console.log("Wallet Generation Status:", status);
      });
      setWalletAddress(addresses?.eip155 || "");
      console.log("✅ Wallet created successfully:", addresses?.eip155);
    } catch (error) {
      console.error("Wallet creation failed:", error);
    }

    console.log("Backing up wallet...");

    // Back up wallet
    try {
      await portalInstance?.backupWallet(BackupMethods.Password, undefined, {
        passwordStorage: {
          password: "password",
        },
      });
      console.log("✅ Wallet backed up successfully");
    } catch (error) {
      console.error("Wallet backup failed:", error);
    }

    console.log("Recovering wallet...");

    // Recover wallet
    try {
      await portalInstance?.recoverWallet(
        "",
        BackupMethods.Password,
        undefined,
        {
          passwordStorage: {
            password: "password",
          },
        }
      );
      console.log("✅ Wallet recovered successfully");
    } catch (error) {
      console.error("Wallet recovery failed:", error);
    } finally {
      setIsWalletCreating(false);
    }
  };

  const handleUSDCTransfer = async () => {
    if (!recipientAddress) return;

    try {
      setIsTransferring(true);

      // Build USDC transfer transaction
      const response = await fetch(
        `https://api.portalhq.io/api/v3/clients/me/chains/${SEPOLIA_CHAIN_ID}/assets/send/build-transaction`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${clientApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            amount: USDC_AMOUNT_TO_SEND,
            to: recipientAddress,
            token: "USDC",
          }),
        }
      );
      const { transaction } = await response.json();

      // Execute transaction using Portal
      const txHash = await portalInstance?.provider.request({
        method: "eth_sendTransaction",
        params: [transaction],
        chainId: SEPOLIA_CHAIN_ID,
      });

      setTransactionHash(txHash as string);
      console.log("✅ Transaction sent successfully:", txHash);
    } catch (error) {
      console.error("Transaction failed:", error);
    } finally {
      setIsTransferring(false);
    }
  };

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
        headerImage={
          <Image
            source={require("@/assets/images/partial-react-logo.png")}
            style={styles.reactLogo}
          />
        }
      >
        <ThemedView style={styles.container}>
          <ThemedText type="title">Portal MPC Wallet</ThemedText>

          {!portalInstance ? (
            <ThemedView style={styles.section}>
              <ThemedText type="subtitle">Connect to Portal</ThemedText>
              <ThemedText>Enter your Client API Key to get started</ThemedText>
              <TextInput
                style={styles.input}
                placeholder="Enter Client API Key"
                value={clientApiKey}
                onChangeText={setClientApiKey}
                placeholderTextColor="#666"
              />
              <Pressable
                onPress={handleInitializePortal}
                style={[styles.button, !clientApiKey && styles.buttonDisabled]}
                disabled={!clientApiKey}
              >
                <ThemedText style={styles.buttonText}>
                  Connect Portal
                </ThemedText>
              </Pressable>
            </ThemedView>
          ) : !walletAddress ? (
            <ThemedView style={styles.section}>
              <ThemedText type="subtitle">Create Your Wallet</ThemedText>
              <ThemedText>
                Generate your MPC wallet to get started with Web3
              </ThemedText>
              <Pressable
                onPress={handleWalletSetup}
                style={[
                  styles.button,
                  isWalletCreating && styles.buttonDisabled,
                ]}
                disabled={isWalletCreating}
              >
                {isWalletCreating ? (
                  <ActivityIndicator color="white" />
                ) : (
                  <ThemedText style={styles.buttonText}>
                    Create Wallet
                  </ThemedText>
                )}
              </Pressable>
            </ThemedView>
          ) : (
            <>
              <ThemedView style={styles.section}>
                <ThemedText type="subtitle">Your Wallet</ThemedText>
                <ThemedView style={styles.addressContainer}>
                  <ThemedText style={styles.address}>
                    {walletAddress}
                  </ThemedText>
                  <Pressable
                    style={styles.copyButton}
                    onPress={() => {
                      Clipboard.setString(walletAddress);
                      Toast.show({
                        type: "success",
                        text1: "Copied to clipboard",
                        position: "bottom",
                      });
                    }}
                  >
                    <ThemedText style={styles.copyButtonText}>Copy</ThemedText>
                  </Pressable>
                </ThemedView>
                <ThemedText>
                  Get test USDC from the{" "}
                  <ThemedText
                    style={styles.link}
                    onPress={() => Linking.openURL("https://faucet.circle.com")}
                  >
                    Circle Faucet
                  </ThemedText>
                  .
                </ThemedText>
                <ThemedText>
                  Get Sepolia ETH for gas fees from the{" "}
                  <ThemedText
                    style={styles.link}
                    onPress={() => Linking.openURL("https://sepoliafaucet.com")}
                  >
                    Sepolia Faucet
                  </ThemedText>
                  .
                </ThemedText>
              </ThemedView>

              <ThemedView style={styles.section}>
                <ThemedText type="subtitle">Send USDC</ThemedText>
                <TextInput
                  style={styles.input}
                  placeholder="Enter destination address"
                  value={recipientAddress}
                  onChangeText={setRecipientAddress}
                  placeholderTextColor="#666"
                />
                <Pressable
                  onPress={handleUSDCTransfer}
                  style={[
                    styles.button,
                    (!recipientAddress || isTransferring) &&
                      styles.buttonDisabled,
                  ]}
                  disabled={!recipientAddress || isTransferring}
                >
                  {isTransferring ? (
                    <ActivityIndicator color="white" />
                  ) : (
                    <ThemedText style={styles.buttonText}>
                      Send 1 USDC
                    </ThemedText>
                  )}
                </Pressable>
                {transactionHash && (
                  <ThemedView style={styles.signatureContainer}>
                    <ThemedText type="subtitle">Transaction Hash:</ThemedText>
                    <ThemedText style={styles.signature}>
                      {transactionHash}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </>
          )}
        </ThemedView>
      </ParallaxScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    gap: 24,
  },
  section: {
    gap: 12,
  },
  button: {
    backgroundColor: "#6e2ada",
    padding: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonDisabled: {
    backgroundColor: "#9b71d3",
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: "#000",
    backgroundColor: "white",
  },
  addressContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  address: {
    flex: 1,
    fontSize: 14,
    color: "#666",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  copyButton: {
    backgroundColor: "#6e2ada",
    padding: 8,
    borderRadius: 6,
  },
  copyButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
  signatureContainer: {
    marginTop: 12,
    gap: 8,
  },
  signature: {
    fontSize: 12,
    color: "#666",
    padding: 12,
    backgroundColor: "#f5f5f5",
    borderRadius: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
  link: {
    color: "#6e2ada",
    textDecorationLine: "underline",
  },
  copyContainer: {
    position: "relative",
  },
  toastContainer: {
    position: "absolute",
    bottom: 40,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
  },
  copiedChip: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 24,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  copiedText: {
    color: "white",
    fontSize: 14,
    fontWeight: "600",
  },
});
