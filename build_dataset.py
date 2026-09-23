import json
from pathlib import Path

OUT = Path(__file__).resolve().parent / 'dataset'
OUT.mkdir(exist_ok=True)
CODES = 'T1 T2 E1 E2 S1 S2 B1 B2 C1 C2'.split()
weights = [.10, .10, .09, .11, .11, .11, .09, .09, .10, .10]
directions = dict(transport='Транспорт', ecology='Экология', social='Соцсфера', safety='Безопасность', services='Сервисы')
names = ['Разгрузка дорог', 'Доступность общественного транспорта', 'Озеленение', 'Качество воздуха', 'Школы и детсады', 'Поликлиники и первичная медпомощь', 'Безопасность улиц', 'Безопасность дорожного движения', 'Надёжность ЖКХ', 'Скорость решения обращений жителей']
best = ['Нет пробок в час пик', 'Все жители в 500 м от остановки с интервалом ≤10 мин', '≥20 м² зелени на жителя', 'Зимой AQI ≤50', '100% нормативной потребности, без 2-й смены', 'Норматив на жителя выполнен полностью', 'Освещение и камеры везде, минимум происшествий', 'Минимум ДТП с пострадавшими', 'Нет аварий отопления/воды за год', 'Все обращения закрыты в срок']
indicators = [dict(code=c, direction_id=list(directions)[i//2], name=names[i], weight=weights[i], meaning_at_100=best[i], meaning_at_0={0:'Стоит всё', 3:'Хронический смог'}.get(i)) for i,c in enumerate(CODES)]
rows = [
    ('esil', 'Есиль', .27, [45,62,68,72,48,55,78,60,75,70],62.99,'Богатый, но с пробками на мостах и переполненными школами.'),
    ('almaty', 'Алматы', .24, [40,75,50,55,60,65,62,52,50,60],57.06,'Старый ЖКХ и пробки.'),
    ('saryarka', 'Сарыарка', .20, [50,70,42,40,62,68,58,55,45,55],54.65,'Смог от частного сектора, слабое озеленение.'),
    ('baikonur', 'Байконур', .13, [52,68,55,50,58,60,52,58,55,58],56.63,'Середняк без ярких перекосов.'),
    ('nura', 'Нура', .16, [55,40,45,65,38,35,55,50,60,50],49.18,'Главный «аутсайдер» по соцсфере и транспорту.'),
]
districts = [dict(id=i,name=n,population_share=p,indicators=dict(zip(CODES,v)),source_district_score=s,profile=t) for i,n,p,v,s,t in rows]
measure_rows = [
 ('transport','Выделенные полосы для автобусов','district',18,2,dict(T1=6,T2=9)),
 ('transport','Умные светофоры (адаптивное управление)','city',22,2,dict(T1=4,B2=3)),
 ('transport','Линия ЛРТ / расширение','district',30,4,dict(T1=16,T2=20,E2=4)),
 ('ecology','Парк / сквер','district',15,2,dict(E1=12,E2=3,B1=2)),
 ('ecology','Перевод частного сектора на чистое топливо','district',25,3,dict(E2=14,C1=4)),
 ('ecology','Городская программа озеленения и ветрозащитных полос','city',20,4,dict(E1=5,E2=3)),
 ('social','Школа + детсад (модульное строительство)','district',24,3,dict(S1=16)),
 ('social','Центр семейного здоровья / поликлиника','district',20,3,dict(S2=14)),
 ('social','Дворовые спорт-хабы','district',10,1,dict(S1=3,S2=3,B1=3)),
 ('safety','Освещение и камеры (расширение Safe City)','district',12,1,dict(B1=12,B2=2)),
 ('safety','Безопасные переходы и школьные зоны','district',10,1,dict(B2=12,T1=-2)),
 ('services','Единая цифровая платформа обращений','city',14,1,dict(C2=5)),
 ('services','Модернизация тепло- и водосетей','district',28,4,dict(C1=18,E2=2)),
 ('services','Аварийные бригады ЖКХ + раннее оповещение','city',16,1,dict(C1=5,C2=2)),
]
measures = [dict(id=f'M{i}',direction_id=d,name=n,scope=s,cost=c,lag_quarters=l,effects=e) for i,(d,n,s,c,l,e) in enumerate(measure_rows,1)]
synergies = [dict(measure_ids=[a,b],target_district_of=a,effects={k:2},scale_by_lag=False) for a,b,k in [('M1','M2','T1'),('M10','M12','B1'),('M5','M6','E2')]]
conflicts = [dict(measure_ids=['M1','M3'],scope='anywhere',reason='Либо BRT, либо ЛРТ, в любом районе.'),dict(measure_ids=['M4','M7'],scope='same_district',reason='Конфликт за участок.'),dict(measure_ids=['M5','M13'],scope='same_district',reason='Дублирование программы.')]
example = [dict(measure_id=m,district_id=d) for m,d in [('M7','nura'),('M8','nura'),('M10','nura'),('M12',None),('M5','saryarka')]]

def calculate(decisions):
    values = {d['id']:dict(d['indicators']) for d in districts}
    selected = {d['measure_id']:d['district_id'] for d in decisions}
    for m in measures:
        if m['id'] not in selected:
            continue
        targets = list(values) if m['scope']=='city' else [selected[m['id']]]
        for target in targets:
            for k,v in m['effects'].items():
                values[target][k] += v*(8-m['lag_quarters'])/8
    for s in synergies:
        if all(m in selected for m in s['measure_ids']):
            target = selected[s['target_district_of']]
            for k,v in s['effects'].items():
                values[target][k] += v
    values = {d:{k:min(100,max(0,v)) for k,v in vs.items()} for d,vs in values.items()}
    scores = {d:sum(vs[k]*w for k,w in zip(CODES,weights)) for d,vs in values.items()}
    avg = sum(d['population_share']*scores[d['id']] for d in districts)
    crit = [dict(district_id=d,indicator_code=k,value=v) for d,vs in values.items() for k,v in vs.items() if v<40]
    return dict(district_scores={k:round(v,8) for k,v in scores.items()},city_average=round(avg,8),minimum_district_score=round(min(scores.values()),8),critical_count=len(crit),critical_values=crit,score=round(.7*avg+.3*min(scores.values())-len(crit),8))

baseline = calculate([])
example_result = calculate(example)
data = dict(schema_version='1.0.0',metadata=dict(title='Районы и мероприятия городского развития',language='ru',source='Предоставленный пользователем текст',city_name=None,cost_unit='условная единица',indicator_scale=dict(min=0,max=100,higher_is_better=True),simulation_horizon_quarters=8),directions=[dict(id=k,name=v) for k,v in directions.items()],indicators=indicators,districts=districts,measures=measures,synergies=synergies,incompatibilities=conflicts,rules=dict(budget=100,required_decision_count=5,allow_repeated_measures=False,max_measures_per_direction=2,district_required_for_scope='district',district_for_city_scope=None,decision_order_matters=False,unused_budget_bonus=0,invalid_selection_score=None,invalid_selection_returns_reasons=True),scoring=dict(effect_factor='(H - lag_quarters) / H',indicator_formula='clip(initial + sum(effects * effect_factor) + synergies, 0, 100)',district_formula='sum(indicator_weight * final_indicator)',city_formula='sum(population_share * district_score)',score_formula='0.7 * city_average + 0.3 * minimum_district_score - 1.0 * critical_count',city_average_weight=.7,minimum_district_weight=.3,critical_threshold=40,critical_comparison='strictly_less_than',critical_penalty_per_pair=1,clip_after_all_effects=True),baseline=baseline,example=dict(decisions=example,total_cost=95,result=example_result),source_claims=dict(baseline_city_average=56.86,baseline_score=52.56,example_score_approx=56.5,example_gain_approx=4.0,cheapest_measure_set=['M9','M11','M10','M12','M4'],cheapest_measure_set_cost=61),llm_role='Объяснять рассчитанные результаты, сравнивать наборы и советовать на основе результатов расчёта; не придумывать и не рассчитывать числа вместо расчётного модуля.')
assert len(districts)==5 and len(measures)==14 and len(indicators)==10
assert abs(sum(weights)-1)<1e-12 and abs(sum(d['population_share'] for d in districts)-1)<1e-12
assert all(set(d['indicators'])==set(CODES) and all(0<=v<=100 for v in d['indicators'].values()) for d in districts)
assert all(set(m['effects'])<=set(CODES) for m in measures)
assert sum(m['cost'] for m in measures if m['id'] in {d['measure_id'] for d in example})==95
for d in districts:
    d['computed_district_score'] = baseline['district_scores'][d['id']]
(OUT/'dataset.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')

def table(headers, rows):
    return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(map(str,r))+' |' for r in rows])

readme = '''# Датасет районов и городских мероприятий

`dataset.json` — основной файл для импорта в проект (UTF-8, стандартный JSON). Содержит 5 районов, 10 показателей, 14 мероприятий, 3 синергии, 3 несовместимости и правила симуляции. Название города в исходнике явно не указано: `city_name: null`.

## Формат

- `directions`, `indicators`, `districts`, `measures` — справочники и исходные данные. Связи задаются через `id`, `direction_id` и коды показателей.
- `population_share` — доля от 0 до 1; все показатели — от 0 до 100, больше значит лучше.
- `effects` — полные изменения показателей в пунктах до учёта лага. Отсутствующий код означает нулевой эффект. Отрицательный эффект M11 на T1 сохранён.
- `scope: district` — действие в одном выбранном районе; `scope: city` — действие во всех районах.
- Решение задаётся как `{"measure_id": "M7", "district_id": "nura"}`; для городской меры `district_id: null` (район не выбран).
- `meaning_at_0: null` означает, что расшифровка нуля не дана в исходнике.
- `source_*` и `source_claims` сохраняют числа и утверждения из исходника; `computed_district_score`, `baseline` и `example.result` содержат пересчёт по формуле.

## Показатели

'''
readme += table(['Код','Направление','Показатель','Вес','Значение 100'],[[i['code'],directions[i['direction_id']],i['name'],i['weight'],i['meaning_at_100']] for i in indicators])
readme += '\n\n## Районы\n\n'+table(['Район','Доля населения']+CODES+['D по формуле','D в исходнике'],[[d['name'],d['population_share']]+list(d['indicators'].values())+[d['computed_district_score'],d['source_district_score']] for d in districts])
readme += '\n\n'+'\n'.join(f"- **{d['name']}**: {d['profile']}" for d in districts)
readme += '\n\n## Мероприятия\n\n'+table(['ID','Направление','Мероприятие','Тип','Стоимость','Лаг, кварталы','Полные эффекты'],[[m['id'],directions[m['direction_id']],m['name'],'Район' if m['scope']=='district' else 'Город',m['cost'],m['lag_quarters'],', '.join(f'{k} {v:+}' for k,v in m['effects'].items())] for m in measures])
readme += '''

## Расчёт и ограничения

Горизонт — 8 кварталов. Доля эффекта меры: `(8 − L) / 8`. Сначала суммируются все эффекты и синергии, затем результат каждого показателя ограничивается диапазоном [0, 100]. D района — сумма показателей с их весами; D_avg — среднее D с весами по долям населения.

`Score = 0.7 × D_avg + 0.3 × min(D) − N_crit`, где N_crit — число пар «район × показатель» строго ниже 40. Промежуточные значения не округляются; вычисленные результаты в JSON записаны с точностью до 8 знаков после запятой.

Нужно выбрать ровно 5 разных мероприятий на сумму ≤100, не более 2 из одного направления. Для районной меры район обязателен, для городской не выбирается. Порядок не важен; остаток бюджета не даёт бонуса. Невалидный набор не получает числового Score; валидатор должен вернуть причины.

Синергии действуют при выборе обеих мер, не масштабируются лагом:

- M1 + M2: T1 +2 в районе M1.
- M10 + M12: B1 +2 в районе M10.
- M5 + M6: E2 +2 в районе M5.

Несовместимости:

- M1 и M3 нельзя выбирать вместе независимо от районов.
- M4 и M7 нельзя выбирать в одном районе.
- M5 и M13 нельзя выбирать в одном районе.

## Проверка исходных расчётов

'''
readme += table(['Величина','В исходнике','По формуле'],[['D_avg без действий',56.86,baseline['city_average']],['Score без действий',52.56,baseline['score']],['Score примера','≈56.5',example_result['score']],['Прирост примера','≈4.0',round(example_result['score']-baseline['score'],8)]])
readme += f'''

Исходные показатели и веса сохранены без изменений. Итоги районов совпадают с исходником; городской балл и Score соответствуют указанным округлённым значениям. Для расчётов используйте полную точность. Базовых критических значений — {baseline['critical_count']}: S1=38 и S2=35 в Нуре.

Пример: M7, M8, M10 — Нура; M12 — город; M5 — Сарыарка. Стоимость 95, набор удовлетворяет ограничениям, действует синергия M10 + M12. После мер критических значений нет.

В исходнике также приведён самый дешёвый набор M9 + M11 + M10 + M12 + M4 стоимостью 61. Назначения районов для него не указаны, поэтому он сохранён как исходное утверждение, а не готовый список решений.

## Использование в Python

```python
import json
from pathlib import Path

data = json.loads(Path("dataset/dataset.json").read_text(encoding="utf-8"))
districts = {{d["id"]: d for d in data["districts"]}}
print(districts["nura"]["indicators"]["S1"])
```

`build_dataset.py` в родительской папке воспроизводит JSON и этот документ, проверяет структуру и пересчитывает базу и пример. Его функция `calculate` предназначена для этих контрольных расчётов и не заменяет валидатор пользовательских решений.

Роль LLM в проекте: объяснять результаты расчётного модуля, сравнивать наборы и давать рекомендации на их основе.
'''
(OUT/'README.md').write_text(readme.rstrip()+'\n',encoding='utf-8')
print(json.dumps(dict(baseline=baseline,example=example_result),ensure_ascii=False,indent=2))
