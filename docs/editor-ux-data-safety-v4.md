# Editor UX / Data Safety v4

이 문서는 Suwol 2D Animator Electron 에디터의 v4 범위를 정리한다. v4는 새 애니메이션 기능을 늘리는 단계가 아니라, 장기 편집에 필요한 안정성, 데이터 보호, 검증 표시, 기본 viewport UX를 보강하는 단계다.

## 범위

- Electron 에디터에서 undo/redo, dirty state, 저장 전 데이터 손실 방지, backup, validation panel을 제공한다.
- export 전에 error/warning을 표시하고, error가 있으면 export를 막는다.
- canvas preview는 zoom, pan, reset, fit to content를 지원한다.
- bone, slot, attachment, animation 이름의 빈 값과 중복 rename을 막는다.
- 위험한 삭제는 자동 cascade 대신 차단 메시지를 표시한다.
- Unity Runtime 포맷과 기존 region, mesh, weighted mesh, deform timeline export/runtime 호환은 유지한다.

## Undo / Redo

- 문서와 imported image 목록 변경은 snapshot 기반 history에 저장된다.
- undo stack은 최대 100개다.
- undo 실행 시 현재 상태는 redo stack으로 이동한다.
- redo 실행 시 현재 상태는 undo stack으로 이동한다.
- selection, current time, preview play state는 history 대상이 아니다.
- 단축키는 `Ctrl+Z`, `Ctrl+Y`, `Ctrl+Shift+Z`를 지원한다.

## Dirty State

- 문서 또는 imported image 목록이 변경되면 dirty 상태가 된다.
- 저장 성공 후 dirty 상태가 해제된다.
- 프로젝트 열기 직후와 생성 직후에는 저장된 프로젝트 파일 기준으로 clean 상태다.
- export는 프로젝트 저장이 아니므로 dirty 상태를 해제하지 않는다.
- window title과 toolbar에 unsaved 상태가 표시된다.

## 데이터 손실 방지

- New Project, Open Project, window close 전에 dirty 상태면 확인 dialog를 띄운다.
- 선택지는 Save, Discard, Cancel이다.
- Save가 실패하면 기존 동작은 계속 진행하지 않는다.

## Backup

- 프로젝트 파일이 열린 상태에서 dirty 변경이 생기면 10초 debounce 후 backup을 생성한다.
- backup은 원본 프로젝트 파일을 덮지 않는다.
- backup 위치는 프로젝트 폴더의 `.backups/` 하위다.
- 최근 20개 backup만 유지하고 오래된 backup은 제거한다.

예:

```text
MyCharacter/
  project.suwol2dproj.json
  .backups/
    project.2026-07-03-153000.suwol2dproj.json
```

## Validation Panel

- 오른쪽 inspector 하단에 validation panel이 표시된다.
- error와 warning 개수를 표시하고 전체 메시지 목록을 보여준다.
- 가능한 경우 validation item 클릭 시 관련 bone, slot, attachment, animation을 선택한다.
- error가 있으면 export를 중단한다.
- warning만 있으면 export는 허용한다.

## Export UX

- export 전 runtime export document를 다시 검증한다.
- error가 있으면 export를 막고 validation panel 확인을 안내한다.
- export 성공 시 export JSON 경로와 복사된 texture 파일명을 status에 표시한다.
- export는 project save와 분리되어 있으며, export만으로 dirty 상태를 clean으로 만들지 않는다.

## Canvas Viewport

- mouse wheel: zoom
- middle mouse drag 또는 right mouse drag: pan
- Reset 버튼 또는 `0`: view reset
- Fit 버튼 또는 `F`: 현재 content에 맞춤
- zoom 범위는 0.1x에서 8x다.
- viewport 조작은 preview 좌표 변환만 바꾸며 JSON 데이터 좌표는 변경하지 않는다.

## 삭제 제한

- root bone은 삭제할 수 없다.
- child bone, slot, animation timeline, mesh weight가 참조하는 bone은 삭제할 수 없다.
- attachment나 deform timeline이 참조하는 slot은 삭제할 수 없다.
- deform timeline이 참조하는 attachment는 삭제할 수 없다.
- attachment 삭제 시 slot의 current attachment 참조는 비운다.
- animation 삭제 시 선택과 현재 animation을 안전하게 갱신한다.

## 이름 정책

- 새 bone, slot, attachment, animation은 자동 unique name을 사용한다.
- rename은 앞뒤 공백을 trim하고 내부 공백을 `_`로 정리한다.
- 빈 이름과 중복 이름은 적용하지 않는다.
- 파일 경로에 위험한 문자는 `_`로 치환한다.

## Slot Draw Order

- slot inspector에서 Move Up, Move Down, Normalize Draw Order를 제공한다.
- UI 목록은 drawOrder 순서로 표시된다.
- normalize는 현재 표시 순서 기준으로 0부터 다시 번호를 부여한다.

## Keyboard Shortcuts

- `Ctrl+S`: Save Project
- `Ctrl+Z`: Undo
- `Ctrl+Y`: Redo
- `Ctrl+Shift+Z`: Redo
- `Space`: Play/Stop preview
- `Delete`: selected item 삭제 시도
- `F`: Fit To Content
- `0`: Reset View

입력창, select, textarea에 focus가 있을 때는 Space/Delete/F/0 같은 편집 방해 단축키를 실행하지 않는다.

## 아직 지원하지 않는 것

- IK
- constraint
- clipping
- linked mesh
- atlas packing
- Spine import/export
- Spine Runtime 참조
- brush weight painting
- brush deform editing
- animation mixing
- state machine
- curve editor
- onion skin
- 복잡한 prefab 자동 생성 시스템
- 별도 Unity 프로젝트 생성
- Unity Runtime 대규모 구조 변경
