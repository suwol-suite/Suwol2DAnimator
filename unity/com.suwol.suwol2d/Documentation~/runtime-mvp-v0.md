# Runtime MVP v0

Mesh Attachment v1 extends this runtime with rigid mesh attachments. See `Documentation~/mesh-attachment-v1.md`.

Weighted Mesh v2 extends mesh attachments with per-vertex bone weights. See `Documentation~/weighted-mesh-v2.md`.

Suwol 2D Runtime MVP v0는 Electron 에디터와 같은 저장소 안에 있는 Unity UPM 패키지입니다. 별도 Unity 프로젝트를 만들지 않고 `unity/com.suwol.suwol2d/` 폴더를 패키지로 관리합니다.

## 지원 기능

- 배열 기반 `.suwol2d.json` v0 데이터 파싱
- bone hierarchy 구성
- bone local/world transform 계산
- slot과 region attachment 연결
- `MeshFilter`와 `MeshRenderer` 기반 region quad 렌더링
- translate, rotate, scale timeline 재생
- linear interpolation
- 기본 loop animation
- `Suwol2DCharacter.Play("idle")`, `Suwol2DCharacter.Play("walk")`

## 아직 지원하지 않는 기능

- Spine 호환성
- Spine JSON import/export
- mesh attachment
- weighted mesh
- deform timeline
- IK
- constraint
- clipping
- 고급 skin 교체
- animation mixing
- state machine
- atlas packing

## Unity 패키지 추가

Unity Package Manager에서 **Add package from disk**를 선택한 뒤 다음 파일을 지정합니다.

```text
C:\Project\Suwol2DAnimator\unity\com.suwol.suwol2d\package.json
```

## 샘플 가져오기

Package Manager에서 `Suwol 2D Animator` 패키지를 선택하고 `Runtime MVP v0` 샘플을 Import합니다.

샘플에는 다음 파일이 들어 있습니다.

```text
sample_character.suwol2d.json
Textures/body.png
Textures/arm.png
```

Unity가 샘플을 import하면 보통 다음과 같은 경로 아래에 복사됩니다.

```text
Assets/Samples/Suwol 2D Animator/0.1.0/Runtime MVP v0/
```

## 샘플 JSON 구조

v0 JSON은 Unity `JsonUtility`로 쉽게 읽을 수 있도록 dictionary가 아니라 배열 기반 구조를 사용합니다.

```json
{
  "version": 0,
  "name": "sample_character",
  "bones": [],
  "slots": [],
  "skins": [],
  "attachments": [],
  "animations": []
}
```

region attachment는 다음 필드를 지원합니다.

```json
{
  "name": "body",
  "slot": "body_slot",
  "type": "region",
  "image": "body",
  "x": 0,
  "y": 0,
  "rotation": 0,
  "width": 0.9,
  "height": 1.35,
  "scaleX": 1,
  "scaleY": 1
}
```

animation은 bone별 timeline 배열을 가집니다.

```json
{
  "name": "idle",
  "loop": true,
  "bones": [
    {
      "bone": "root",
      "translate": [{ "time": 0, "x": 0, "y": 0 }],
      "rotate": [],
      "scale": []
    }
  ]
}
```

## Demo 실행

샘플을 Import한 뒤 Unity 메뉴에서 실행합니다.

```text
Tools/Suwol2D/Create Runtime MVP Demo
```

이 메뉴는 Edit Mode에서 실행합니다. 현재 씬에 `Suwol2D Runtime MVP Demo` GameObject가 이미 있으면 중복 생성하지 않고 기존 object를 다시 설정합니다.

메뉴가 하는 일:

- `Suwol2DCharacter` 컴포넌트 추가
- `Assets/Suwol2D Runtime MVP/Suwol2DDefault.mat` material 생성 또는 재사용
- `sample_character.suwol2d.json`, `body.png`, `arm.png` 자동 검색 및 연결
- demo object 선택

자동 연결이 안 되면 Console 안내에 따라 inspector에서 직접 할당합니다.

Enter Play Mode를 누르면 기본 `idle` animation이 재생됩니다. Play Mode 중 inspector 버튼으로 `idle`과 `walk`를 바꿔 볼 수 있습니다.

## Inspector 필드

`Suwol2DCharacter` 필드는 다음처럼 설정합니다.

- `Json Asset`: `sample_character.suwol2d.json`
- `Textures`: `body.png`, `arm.png`
- `Default Material`: `Suwol2DDefault.mat` 또는 `Sprites/Default` 호환 material
- `Play On Awake`: 켜면 Play Mode 시작 시 `Initial Animation`을 재생
- `Initial Animation`: `idle`
- `Animation Speed`: `1`이 기본 속도, `0`은 정지, 음수는 `0`으로 처리

texture 이름은 JSON attachment의 `image` 값과 맞아야 합니다. 샘플 JSON은 `body`, `arm`을 사용하므로 texture asset 이름도 `body`, `arm`이어야 합니다.

## idle/walk 테스트

1. `Tools/Suwol2D/Create Runtime MVP Demo`를 실행합니다.
2. Game view 카메라가 원점 근처를 보고 있는지 확인합니다. 기본 2D 카메라 위치 `(0, 0, -10)`이면 충분합니다.
3. Play Mode에 들어갑니다.
4. `idle`에서 body/root가 위아래로 움직이고 body가 살짝 회전하는지 확인합니다.
5. Inspector의 `Play walk` 버튼을 눌러 arm이 좌우로 크게 회전하는지 확인합니다.
6. `sample_character.suwol2d.json`의 key 값을 바꾸고 다시 import/Play하면 움직임이 바뀌어야 합니다.

## 코드 사용 예시

```csharp
using Suwol.Suwol2D;
using UnityEngine;

public sealed class SuwolExample : MonoBehaviour
{
    private void Start()
    {
        var character = GetComponent<Suwol2DCharacter>();
        character.Play("idle");
        character.SetAnimationSpeed(1.2f);
    }
}
```

## 흔한 문제

- `jsonAsset`이 비어 있음: Runtime MVP v0 샘플을 import한 뒤 `sample_character.suwol2d.json`을 `Json Asset`에 할당합니다.
- `textures` 배열이 비어 있음: `body.png`, `arm.png`를 `Textures` 배열에 넣습니다.
- material이 없음: demo 메뉴를 다시 실행하거나 `Sprites/Default`를 사용하는 material을 직접 할당합니다.
- texture를 찾지 못함: JSON의 attachment `image` 값과 texture asset 이름이 같은지 확인합니다. 확장자는 비교하지 않습니다.
- sample asset을 찾지 못함: Package Manager에서 `Runtime MVP v0` 샘플을 Import했는지 확인합니다.
- 아무것도 보이지 않음: Game view 카메라가 원점 근처를 보고 있는지, object scale이 1인지, Play Mode인지 확인합니다.
- `walk`가 안 됨: Play Mode 중 inspector의 `Play walk` 버튼을 누르거나 코드에서 `character.Play("walk")`를 호출합니다.
