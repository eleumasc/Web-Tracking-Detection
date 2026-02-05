import _ from "lodash";

export function clusterWith<T>(
  elements: T[],
  comparator: (x: T, y: T) => boolean = _.isEqual,
): T[][] {
  elements = [...elements];
  const clusters: T[][] = [];
  let firstElement: T | undefined;
  while ((firstElement = elements.shift())) {
    const cluster: T[] = [firstElement];
    const restElements: T[] = [];
    let element: T | undefined;
    while ((element = elements.shift())) {
      const dest = comparator(element, firstElement) ? cluster : restElements;
      dest.push(element);
    }
    clusters.push(cluster);
    elements = restElements;
  }
  return clusters;
}

export function clusterObjectsBy<T extends object, K>(
  elements: T[],
  keyFn: (x: T) => K,
): T[][] {
  const keyMap = new WeakMap<T, K>();
  const getKey = (element: T) => {
    let key = keyMap.get(element);
    if (!key) {
      key = keyFn(element);
      keyMap.set(element, key);
    }
    return key;
  };
  return clusterWith(elements, (x, y) => _.isEqual(getKey(x), getKey(y)));
}
