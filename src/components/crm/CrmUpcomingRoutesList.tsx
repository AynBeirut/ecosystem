import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  filterNextUpcomingRoutes,
  filterRoutesForDate,
  routeProgressOnDate,
  REPEAT_LABELS,
  toDateYmd,
  type CrmVisitRoute,
} from '@/lib/crmVisitRouteService';
import { cn } from '@/lib/utils';

type Props = {
  routes: CrmVisitRoute[];
  repFilter?: string;
  repIds?: string[];
  customerDateYmd?: string;
  showAllRoutesWhenDateEmpty?: boolean;
  onCreateRoute?: () => void;
  compact?: boolean;
};

function filterByRep(
  list: CrmVisitRoute[],
  repKey?: string,
  repIds?: string[],
): CrmVisitRoute[] {
  if (repIds?.length) {
    return list.filter((r) => repIds.includes(r.assignedRepId));
  }
  if (repKey) {
    return list.filter((r) => r.assignedRepId === repKey);
  }
  return list;
}

export default function CrmUpcomingRoutesList({
  routes,
  repFilter,
  repIds,
  customerDateYmd,
  showAllRoutesWhenDateEmpty,
  onCreateRoute,
  compact,
}: Props) {
  const repKey = repIds?.length ? undefined : (repFilter === 'all' ? undefined : repFilter);

  const { upcoming, title } = useMemo(() => {
    if (customerDateYmd) {
      const onDate = filterRoutesForDate(routes, customerDateYmd, repKey, repIds).map((route) => ({
        dateYmd: customerDateYmd,
        route,
      }));
      if (onDate.length > 0) {
        return { upcoming: onDate, title: `Visit routes · ${customerDateYmd}` };
      }
      if (showAllRoutesWhenDateEmpty) {
        const all = filterByRep(routes.filter((r) => r.status !== 'archived'), repKey, repIds)
          .map((route) => ({ dateYmd: route.visitDate, route }))
          .sort((a, b) => a.dateYmd.localeCompare(b.dateYmd));
        return { upcoming: all, title: 'All visit routes' };
      }
      return { upcoming: [], title: `Visit routes · ${customerDateYmd}` };
    }
    return {
      upcoming: filterNextUpcomingRoutes(routes, 14, repKey, repIds),
      title: 'Upcoming visit routes',
    };
  }, [routes, customerDateYmd, repKey, repIds, showAllRoutesWhenDateEmpty]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold">{title}</h3>
        {onCreateRoute ? (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={onCreateRoute}>
            ＋ New route
          </Button>
        ) : (
          <Button type="button" variant="link" size="sm" className="h-auto p-0" asChild>
            <Link to="/admin/crm/visit-routes/new">＋ New route</Link>
          </Button>
        )}
      </div>
      {upcoming.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {customerDateYmd
            ? 'No visit routes on this customer date.'
            : 'No routes scheduled. Create a visit route from Map & pipeline.'}
        </p>
      ) : (
        <div className="space-y-2">
          {upcoming.map(({ dateYmd, route }) => {
            const prog = routeProgressOnDate(route, dateYmd);
            const overdue = dateYmd < toDateYmd(new Date());
            return (
              <Link
                key={`${route.id}-${dateYmd}`}
                to={`/admin/crm/visit-routes/${route.id}?date=${dateYmd}`}
                className="block"
              >
                <Card className={cn('transition-colors hover:bg-muted/40', compact && 'shadow-sm')}>
                  <CardContent className={cn('p-3', compact && 'py-2')}>
                    <p className="font-semibold text-sm">{route.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      📅 {dateYmd}
                      {overdue ? ' · overdue' : ''}
                      {' · '}
                      {route.assignedRepName}
                      {' · '}
                      {prog.done}/{prog.total} done
                      {route.repeatRule !== 'none' ? ` · ${REPEAT_LABELS[route.repeatRule]}` : ''}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
