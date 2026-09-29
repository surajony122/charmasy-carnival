import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  BlockStack,
  InlineStack,
  Badge,
  IndexTable,
  useIndexResourceState,
  Tabs,
  Button,
  Select,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const actionType = formData.get("actionType");

  if (actionType === "toggleTestMode") {
    const current = await prisma.gameSettings.findUnique({ where: { shop } });
    const currentMode = current ? current.testMode : true;
    const newMode = !currentMode;
    await prisma.gameSettings.upsert({
      where: { shop },
      update: { testMode: newMode },
      create: { shop, testMode: newMode, activeGameId: 1 },
    });
    return json({ success: true, testMode: newMode });
  }

  if (actionType === "setActiveGame") {
    const gameId = parseInt(formData.get("activeGameId") || "1", 10);
    await prisma.gameSettings.upsert({
      where: { shop },
      update: { activeGameId: gameId },
      create: { shop, activeGameId: gameId, testMode: true },
    });
    return json({ success: true });
  }

  return json({ success: false });
};

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const [plays, settingsRecord] = await Promise.all([
    prisma.gamePlay.findMany({
      where: { shop },
      orderBy: { playedAt: 'desc' },
      take: 500,
    }),
    prisma.gameSettings.findUnique({
      where: { shop },
    }),
  ]);

  const settings = settingsRecord || { testMode: true, activeGameId: 1 };

  return json({ plays, settings });
};

export default function Index() {
  const { plays, settings } = useLoaderData();
  const submit = useSubmit();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selectedTab, setSelectedTab] = useState(0);

  const gameNames = {
    1: "Charmacy Claw",
    2: "Spin The Glam Wheel",
    3: "Catch My Charmacy",
    4: "Pick The Right Shade",
    5: "Mirror Match",
    6: "Tap The Sprinkle",
    7: "Blow The Balloon",
    8: "Scratch Card",
    9: "Solve The Puzzle"
  };

  const tabs = [
    { id: 'all', content: 'All Games', gameId: null },
    ...Object.entries(gameNames).map(([id, name]) => ({
      id: `game-${id}`,
      content: name,
      gameId: parseInt(id)
    }))
  ];

  const handleTabChange = useCallback(
    (selectedTabIndex) => setSelectedTab(selectedTabIndex),
    [],
  );

  const filteredPlays = selectedTab === 0 
    ? plays 
    : plays.filter(play => play.gameId === tabs[selectedTab].gameId);

  const { selectedResources, allResourcesSelected, handleSelectionChange } = useIndexResourceState(filteredPlays);

  const rowMarkup = filteredPlays.map(
    (play, index) => (
      <IndexTable.Row
        id={play.id}
        key={play.id}
        selected={selectedResources.includes(play.id)}
        position={index}
      >
        <IndexTable.Cell>
          <Text variant="bodyMd" fontWeight="bold" as="span">
            {play.orderId}
          </Text>
        </IndexTable.Cell>
        <IndexTable.Cell>{play.customerId || "Guest"}</IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone="info">{gameNames[play.gameId]}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {play.won ? <Badge tone="success">Won</Badge> : <Badge tone="critical">Lost</Badge>}
        </IndexTable.Cell>
        <IndexTable.Cell>{play.prizeType || "-"}</IndexTable.Cell>
        <IndexTable.Cell>{play.prizeValue || "-"}</IndexTable.Cell>
        <IndexTable.Cell>{new Date(play.playedAt).toLocaleString()}</IndexTable.Cell>
      </IndexTable.Row>
    ),
  );

  return (
    <Page title="Carnival Analytics Dashboard">
      <Layout>
        <Layout.Section>
          <BlockStack gap="500">
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <InlineStack gap="200" blockAlign="center">
                      <Text as="h2" variant="headingMd">
                        🎪 Carnival Game Mode & Activation
                      </Text>
                      {settings.testMode ? (
                        <Badge tone="success">🟢 ALL 9 GAMES ACTIVE (TEST MODE)</Badge>
                      ) : (
                        <Badge tone="attention">🔒 24H COUNTDOWN MODE (CUSTOMERS)</Badge>
                      )}
                    </InlineStack>
                    <Text as="p" variant="bodySm" tone="subdued">
                      {settings.testMode
                        ? "Test Mode is ON: All 9 daily games are unlocked and playable for testing."
                        : "Live Customer Mode is ON: Only today's game is active. Upcoming games show a live 24-hour countdown timer."}
                    </Text>
                  </BlockStack>
                  <Button
                    variant={settings.testMode ? "primary" : "secondary"}
                    loading={isSubmitting}
                    onClick={() => {
                      const fd = new FormData();
                      fd.append("actionType", "toggleTestMode");
                      submit(fd, { method: "post" });
                    }}
                  >
                    {settings.testMode ? "Switch to 24H Customer Countdown Mode" : "Activate All Games (Test Mode)"}
                  </Button>
                </InlineStack>

                <InlineStack gap="300" blockAlign="center">
                  <Text as="span" variant="bodySm" fontWeight="bold">
                    Active Game for Customer Mode:
                  </Text>
                  <div style={{ width: "280px" }}>
                    <Select
                      label=""
                      labelHidden
                      options={[
                        { label: "Day 1 (12 Oct) - Charmacy Claw", value: "1" },
                        { label: "Day 2 (13 Oct) - Spin The Glam Wheel", value: "2" },
                        { label: "Day 3 (14 Oct) - Catch My Charmacy", value: "3" },
                        { label: "Day 4 (15 Oct) - Pick The Right Shade", value: "4" },
                        { label: "Day 5 (16 Oct) - Mirror Match", value: "5" },
                        { label: "Day 6 (17 Oct) - Tap The Sparkle", value: "6" },
                        { label: "Day 7 (18 Oct) - Birthday Balloon Pop", value: "7" },
                        { label: "Day 8 (19 Oct) - Scratch & Win Card", value: "8" },
                        { label: "Day 9 (20 Oct) - Solve The Puzzle", value: "9" },
                      ]}
                      value={String(settings.activeGameId || 1)}
                      onChange={(val) => {
                        const fd = new FormData();
                        fd.append("actionType", "setActiveGame");
                        fd.append("activeGameId", val);
                        submit(fd, { method: "post" });
                      }}
                    />
                  </div>
                </InlineStack>
              </BlockStack>
            </Card>

            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between">
                  <Text as="h2" variant="headingMd">
                    Game Plays Overview
                  </Text>
                  <Badge tone="success">{filteredPlays.length} Plays</Badge>
                </InlineStack>
                <Text as="p" variant="bodyMd" tone="subdued">
                  Select a game from the tabs below to view its specific performance and see which customers won prizes.
                </Text>
              </BlockStack>
            </Card>

            <Card padding="0">
              <Tabs tabs={tabs} selected={selectedTab} onSelect={handleTabChange} />
              <IndexTable
                resourceName={{ singular: 'game play', plural: 'game plays' }}
                itemCount={filteredPlays.length}
                selectedItemsCount={
                  allResourcesSelected ? 'All' : selectedResources.length
                }
                onSelectionChange={handleSelectionChange}
                headings={[
                  { title: 'Order ID' },
                  { title: 'Customer' },
                  { title: 'Game' },
                  { title: 'Status' },
                  { title: 'Prize Type' },
                  { title: 'Prize Value' },
                  { title: 'Played At' },
                ]}
              >
                {rowMarkup}
              </IndexTable>
            </Card>
          </BlockStack>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
