import { useState, useCallback } from "react";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
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
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  // Fetch all game plays from database
  const plays = await prisma.gamePlay.findMany({
    where: { shop },
    orderBy: { playedAt: 'desc' },
    take: 500
  });

  return json({ plays });
};

export default function Index() {
  const { plays } = useLoaderData();
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
