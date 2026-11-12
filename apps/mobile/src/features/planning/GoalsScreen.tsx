import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/ui/AppText';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { dateLabel, goalSaved, money } from '../preview/finance';
import { useAppStore } from '../../data/store';
import { EmptyState, Meter, Page, Resource } from '../preview/ui';

export function GoalsScreen() {
  const goals = useAppStore((state) => state.goals);
  const saved = goals.reduce((sum, goal) => sum + goalSaved(goal), 0);
  return (
    <Page title="A little closer" subtitle="Make room for the things you’re looking forward to.">
      <Resource>
        <View style={{ gap: 24 }}>
          <Card>
            <AppText variant="label">Across your goals</AppText>
            <AppText variant="title">{money(saved)}</AppText>
            <AppText colour="muted">Manually tracked contributions. No money is moved.</AppText>
            <Button label="Create a goal" onPress={() => router.push('/goal')} />
          </Card>
          {goals.length ? (
            goals.map((goal) => (
              <Card key={goal.id}>
                <AppText variant="heading">{goal.name}</AppText>
                <Meter
                  label={`${goal.name} progress`}
                  value={goalSaved(goal)}
                  limit={goal.targetPaise}
                  detail={`${money(goalSaved(goal))} of ${money(goal.targetPaise)}`}
                />
                <AppText colour="muted">
                  {goalSaved(goal) >= goal.targetPaise
                    ? 'Target reached'
                    : `${money(goal.targetPaise - goalSaved(goal))} to go`}
                  {goal.targetDate
                    ? ` · Target ${dateLabel(goal.targetDate)}`
                    : ' · No target date'}
                </AppText>
                <Button
                  label={`View ${goal.name}`}
                  variant="secondary"
                  onPress={() => router.push({ pathname: '/goal-detail', params: { id: goal.id } })}
                />
              </Card>
            ))
          ) : (
            <EmptyState
              title="What are you looking forward to?"
              detail="Create your first goal, then add contributions as you go."
              action="Create your first goal"
              onAction={() => router.push('/goal')}
            />
          )}
        </View>
      </Resource>
    </Page>
  );
}
